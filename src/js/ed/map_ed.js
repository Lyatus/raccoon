// Raccoon map editor
'use strict';

function rcn_map_ed() {
  rcn_map_ed.prototype.__proto__ = rcn_window.prototype;
  rcn_window.call(this);

  // Init map editing state
  this.current_offset_x = 0;
  this.current_offset_y = 0;

  const map_ed = this;

  // Create map coords text
  this.map_coords_text = document.createElement('div');
  this.map_coords_text.classList.add('map_coords');
  this.add_child(this.map_coords_text);

  // Create map canvas
  this.map_canvas = new rcn_canvas();
  this.map_canvas.node.classList.add('map');
  let shift_start_client_x, shift_start_client_y, shift_start_offset_x, shift_start_offset_y;
  this.map_canvas.interaction(function(e, tex_coords) {
    if(e.buttons == 1) { // Left button: draw
      map_ed.set_tile(tex_coords.x >> 3, tex_coords.y >> 3);
    } else if(e.buttons == 2) { // Right button: tile pick
      rcn_current_sprite = map_ed.get_tile(tex_coords.x >> 3, tex_coords.y >> 3);
      rcn_current_sprite_columns = rcn_current_sprite_rows = 1;
      map_ed.update_map_canvas();
      rcn_dispatch_ed_event('rcn_current_sprite_change');
    } else if(e.buttons == 4) { // Middle button: shift map
      if(e.type == 'mousedown') {
        shift_start_client_x = e.clientX;
        shift_start_client_y = e.clientY;
        shift_start_offset_x = map_ed.current_offset_x;
        shift_start_offset_y = map_ed.current_offset_y;
        e.preventDefault();
      }
      if(shift_start_client_x != undefined && shift_start_offset_y != undefined) {
        const vp = map_ed.map_canvas.compute_viewport();
        map_ed.current_offset_x = shift_start_offset_x + (shift_start_client_x - e.clientX) / (vp.mul * 8);
        map_ed.current_offset_y = shift_start_offset_y + (shift_start_client_y - e.clientY) / (vp.mul * 8);
        map_ed.current_offset_x = Math.max(0, Math.min(128 - 16, map_ed.current_offset_x)) << 0;
        map_ed.current_offset_y = Math.max(0, Math.min(64 - 16, map_ed.current_offset_y)) << 0;
        map_ed.update_map_canvas();
        e.preventDefault();
      }
    }
  });
  this.hover = new rcn_hover(this.map_canvas);
  this.hover.tile_size = 8;
  this.hover.onchange = function() {
    if(this.is_hovering()) {
      const abs_tile_x = this.current_x + map_ed.current_offset_x;
      const abs_tile_y = this.current_y + map_ed.current_offset_y;

      map_ed.map_coords_text.innerText =
        abs_tile_x.toString().padStart(3, '0') + ';' +
        abs_tile_y.toString().padStart(3, '0');
    } else {
      map_ed.map_coords_text.innerText = '???;???';
    }
    map_ed.update_map_canvas();
  }
  this.add_child(this.map_canvas.node);

  this.addEventListener('rcn_bin_change', function(e) {
    // Map data update
    const mem_map_begin = rcn.mem_map_offset;
    const mem_map_end = rcn.mem_map_offset + rcn.mem_map_size;
    if(e.detail.begin < mem_map_end && e.detail.end > mem_map_begin) {
      map_ed.update_map_canvas();
    }

    // Palette update
    const mem_palette_begin = rcn.mem_palette_offset;
    const mem_palette_end = rcn.mem_palette_offset + rcn.mem_palette_size;
    if(e.detail.begin < mem_palette_end && e.detail.end > mem_palette_begin) {
      map_ed.update_map_canvas();
    }

    // Spritesheet data update
    const mem_spritesheet_begin = rcn.mem_spritesheet_offset;
    const mem_spritesheet_end = rcn.mem_spritesheet_offset + rcn.mem_spritesheet_size;
    if(e.detail.begin < mem_spritesheet_end && e.detail.end > mem_spritesheet_begin) {
      map_ed.update_map_canvas();
    }
  });

  this.addEventListener('rcn_window_resize', function() {
    map_ed.map_canvas.flush();
  });

  this.hover.onchange();
  this.update_map_canvas();
}

rcn_map_ed.prototype.title = 'Map Editor';
rcn_map_ed.prototype.docs_link = 'map-editor';
rcn_map_ed.prototype.type = 'map_ed';

rcn_map_ed.prototype.get_tile_index = function(map_x, map_y) {
  const x = map_x + this.current_offset_x;
  const y = map_y + this.current_offset_y;
  return rcn.mem_map_offset + (y << 7) + (x << 0);
}

rcn_map_ed.prototype.set_tile = function(map_x, map_y) {
  const tile_index = this.get_tile_index(map_x, map_y);
  rcn_global_bin.rom[tile_index] = rcn_current_sprite;

  rcn_dispatch_ed_event('rcn_bin_change', {
    begin: tile_index,
    end: tile_index+1,
  });
}

rcn_map_ed.prototype.get_tile = function(map_x, map_y) {
  const tile_index = this.get_tile_index(map_x, map_y);
  return rcn_global_bin.rom[tile_index];
}

rcn_map_ed.prototype.update_map_canvas = function() {
  const map_w = 16;
  const map_h = 16;
  const pixels = new Uint8Array(((map_w * map_h) << 6) >> 1);
  const map_row_size = (map_w << 3) >> 1;

  const draw_tile = function(pixels, mx, my, spr) {
    const pix_x = mx << 3;
    const pix_y = my << 3;
    const pix_index = (pix_y<<6)+(pix_x>>1);
    const spr_tex_index = ((spr & 0xf) << 2) + ((spr >> 4) << 9);
    const spr_row_size = 4;

    for(let i = 0; i < 8; i++) {
      const spr_row_index = spr_tex_index + (i << 6);
      pixels.set(rcn_global_bin.rom.slice(spr_row_index, spr_row_index + spr_row_size), pix_index + i * map_row_size);
    }
  }

  for(let mx = 0; mx < map_w; mx++) {
    for(let my = 0; my < map_h; my++) {
      draw_tile(pixels, mx, my, this.get_tile(mx, my));
    }
  }

  // Draw hovered tile with stamp
  if(this.hover.is_hovering()) {
    draw_tile(pixels, this.hover.current_x, this.hover.current_y, rcn_current_sprite);
  }

  this.map_canvas.set_size(map_w << 3, map_h << 3);
  this.map_canvas.blit(0, 0, map_w << 3, map_h << 3, pixels);
  this.map_canvas.flush();
}

rcn_editors.push(rcn_map_ed);
