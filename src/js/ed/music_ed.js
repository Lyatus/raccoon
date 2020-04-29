// Raccoon music editor
'use strict';

function rcn_music_ed() {
  rcn_music_ed.prototype.__proto__ = rcn_window.prototype;
  rcn_window.call(this);

  this.music_row = [];
  this.track_input = [];
  this.flag_checkbox = [];
  this.play_index = -1;

  const music_ed = this;

  // Create VM
  this.vm = new rcn_vm({
    no_canvas: true,
    dom_element: this.section,
  });
  const vm_onmessage = this.vm.onmessage;
  this.vm.onmessage = function(e) {
    vm_onmessage.call(this, e);
    music_ed.onmessage(e);
  }

  // Create music table
  const music_table = document.createElement('table');
  this.add_child(music_table);

  // Create music rows
  for(let music = 0; music < rcn.music_count; music++) {
    const music_row = document.createElement('tr');
    this.music_row.push(music_row);
    music_table.appendChild(music_row);

    // Create music index
    const music_index = document.createElement('td');
    music_row.appendChild(music_index);
    music_index.innerText = String(music).padStart(2, '0');

    // Create play button
    const music_play_button = rcn_ui_button({
      value: '▶️',
      onclick: () => music_ed.play(music),
    });
    music_play_button.classList.add('play_button');
    music_row.appendChild(music_play_button);

    // Create stop button
    const music_stop_button = rcn_ui_button({
      value: '⏹️',
      onclick: () => music_ed.stop(),
    });
    music_stop_button.classList.add('stop_button');
    music_row.appendChild(music_stop_button);

    // Create track inputs
    for(let track = 0; track < rcn.music_track_count; track++) {
      const input_cell = document.createElement('td');
      music_row.appendChild(input_cell);

      const track_input = document.createElement('div');
      track_input.contentEditable = true;
      track_input.onfocus = function() {
        let range = document.createRange();
        range.selectNodeContents(this);
        let selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
      track_input.oninput = function() {
        if(this.innerText.match(/^(-+|\s*)$/i)) {
          music_ed.set_track(music, track, -1);
          this.onfocus();
        } else if(this.innerText.length >= 2) {
          music_ed.set_track(music, track, Number(this.innerText));
          this.onfocus();
        }
      }
      input_cell.appendChild(track_input);

      this.track_input.push(track_input);
    }

    // Create music flags
    const set_flag = function(i) {
      return function(e) {
        const flag_offset = rcn.mem_music_offset + music * 4 + i;
        if(e.target.checked) {
          rcn_global_bin.rom[flag_offset] |= 0x80;
        } else {
          rcn_global_bin.rom[flag_offset] &= 0x7f;
        }
        rcn_dispatch_ed_event('rcn_bin_change', {
          begin: flag_offset,
          end: flag_offset + 1,
        });
      };
    }
    const begin_flag = rcn_ui_checkbox({label: '⤵️', onchange: set_flag(0)});
    const end_flag = rcn_ui_checkbox({label: '⤴️', onchange: set_flag(1)});
    const stop_flag = rcn_ui_checkbox({label: '🛑', onchange: set_flag(2)});
    this.flag_checkbox.push(begin_flag.checkbox);
    this.flag_checkbox.push(end_flag.checkbox);
    this.flag_checkbox.push(stop_flag.checkbox);
    music_row.appendChild(begin_flag);
    music_row.appendChild(end_flag);
    music_row.appendChild(stop_flag);
  }

  this.addEventListener('rcn_bin_change', function(e) {
    // Music update
    const mem_music_begin = rcn.mem_music_offset;
    const mem_music_end = rcn.mem_music_offset + rcn.mem_music_size;
    if(e.detail.begin < mem_music_end && e.detail.end > mem_music_begin) {
      music_ed.update_tracks();
    }
    if(e.detail.begin < e.detail.end) {
      music_ed.vm.load_memory(rcn_global_bin.rom.slice(e.detail.begin, e.detail.end), e.detail.begin);
    }
  });

  this.vm.load_memory(rcn_global_bin.rom);
  this.update_tracks();
}

rcn_music_ed.prototype.title = 'Music Editor';
rcn_music_ed.prototype.docs_link = 'music-editor';
rcn_music_ed.prototype.type = 'music_ed';
rcn_editors.push(rcn_music_ed);

rcn_music_ed.prototype.set_play_index = function(index) {
  if(this.play_index >= 0) {
    this.music_row[this.play_index].classList.remove('playing');
  }
  this.play_index = index;
  if(this.play_index >= 0) {
    this.music_row[this.play_index].classList.add('playing');
  }
}

rcn_music_ed.prototype.get_music_offset = function(music) {
  return rcn.mem_music_offset + music * 4;
}

rcn_music_ed.prototype.set_track = function(music, track, sound) {
  const music_offset = this.get_music_offset(music);
  rcn_global_bin.rom[music_offset + track] &= 0x80;
  if(sound >= 0) {
    rcn_global_bin.rom[music_offset + track] |= 0x40 | sound;
  }
  rcn_dispatch_ed_event('rcn_bin_change', {
    begin: music_offset + track,
    end: music_offset + track + 1,
  });
}

rcn_music_ed.prototype.get_track = function(music, track) {
  const music_offset = this.get_music_offset(music);
  const track_byte = rcn_global_bin.rom[music_offset + track];
  return track_byte & 0x40 ? track_byte & 0x3f : -1;
}

rcn_music_ed.prototype.update_tracks = function() {
  for(let music = 0; music < rcn.music_count; music++) {
    // Update tracks
    for(let track = 0; track < rcn.music_track_count; track++) {
      const track_index = music * 4 + track;
      const sound = this.get_track(music, track);
      this.track_input[track_index].innerText = sound >= 0 ? String(sound).padStart(2, '0') : '--';
    }

    // Update flags
    const music_offset = this.get_music_offset(music);
    this.flag_checkbox[music * 3 + 0].checked = rcn_global_bin.rom[music_offset + 0] & 0x80;
    this.flag_checkbox[music * 3 + 1].checked = rcn_global_bin.rom[music_offset + 1] & 0x80;
    this.flag_checkbox[music * 3 + 2].checked = rcn_global_bin.rom[music_offset + 2] & 0x80;
  }
}

rcn_music_ed.prototype.play = function(music) {
  this.vm.load_code(`mus(${music});`);
}

rcn_music_ed.prototype.stop = function(music) {
  this.vm.load_code(`mus(-1);`);
}

rcn_music_ed.prototype.onmessage = function(e) {
  switch(e.data.type) {
    case 'audio':
      this.vm.worker.postMessage({type: 'read', name: 'music', offset: rcn.mem_musicstate_offset, size: rcn.mem_musicstate_size});
      break;
    case 'music':
      const is_playing = (e.data.bytes[0] & 0x80) != 0;
      const index = e.data.bytes[0] & 0x7f;
      this.section.classList.toggle('playing', is_playing);
      if(is_playing) {
        this.set_play_index(index);
      } else {
        this.set_play_index(-1);
      }
      break;
  }
}
