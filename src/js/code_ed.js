// Raccoon code editor

function rcn_code_ed() {
  this.window = new rcn_window('code_ed', 'Code Editor');
  this.textarea = document.createElement('textarea');

  var code_ed = this;
  this.textarea.onkeydown = function(e) {
    const key_code = e.keyCode || e.which;
    const tab_size = 2;

    const start = this.selectionStart;
    const end = this.selectionEnd;
    const start_line_beg = this.value.lastIndexOf('\n', start-1)+1;
    const start_line_end = (this.value.indexOf('\n', start) + 1 || this.value.length) - 1;
    const end_line_beg = this.value.lastIndexOf('\n', end-1)+1;
    const line_last_space = Math.max(0, this.value.substr(start_line_beg).search(/[^ ]/))+start_line_beg;

    if(key_code == 13) { // Enter key
      if(e.ctrlKey) { // CTRL + Enter
        code_ed.apply();
      } else if(!e.shiftKey) { // Simple Enter
        e.preventDefault();
        rcn_code_ed_textarea_insert_text(this, '\n'+' '.repeat(line_last_space-start_line_beg));
      }
    } else if (key_code == 9) { // Tab key
      e.preventDefault();

      if(start_line_beg == end_line_beg) { // Same line selection
        if(e.shiftKey) {
          this.selectionEnd = line_last_space;
          this.selectionStart = Math.max(line_last_space - tab_size, start_line_beg);
          var diff = this.selectionStart - this.selectionEnd;
          rcn_code_ed_textarea_insert_text(this, '');
          this.selectionStart = Math.max(start_line_beg, start + diff);
          this.selectionEnd = Math.max(start_line_beg, end + diff);
        } else {
          const chars_offset = tab_size - ((start-start_line_beg) % tab_size);
          rcn_code_ed_textarea_insert_text(this, ' '.repeat(chars_offset));
        }
      }
    }
  };
  this.textarea.onchange = function() {
    rcn_global_bin.code = this.value;
  };
  this.window.add_child(this.textarea);

  this.apply_button = rcn_ui_button({
    window: this.window,
    value:'Apply',
    onclick: function() {
      code_ed.apply();
    },
  });

  this.window.addEventListener('rcnbinchange', function(e) {
    if(e.detail.code) {
      code_ed.textarea.value = rcn_global_bin.code;
    }
  });
}

rcn_code_ed.prototype.apply = function() {
  rcn_global_vm.load_code(this.textarea.value);
}

function rcn_code_ed_textarea_insert_text(textarea, text) {
  if(!document.execCommand('insertText', false, text)) {
    // It didn't work with insertText, fallback to shitty slicing
    const previous_selection_start = textarea.selectionStart;
    const previous_selection_end = textarea.selectionEnd;
    const before = textarea.value.slice(0, textarea.selectionStart);
    const after = textarea.value.slice(textarea.selectionEnd);
    textarea.value = before + text + after;
    textarea.selectionStart = previous_selection_start + text.length;
    textarea.selectionEnd = textarea.selectionStart;
  }
}
