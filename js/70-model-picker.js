/* 小未来 · WeChat API 模型触屏选择器
 * 原生 #wx-edit-api-model 仍是唯一值源；本脚本只提供触摸/键盘交互层。
 */
(function () {
  'use strict';

  var SELECTOR = '#wx-edit-api-model';
  var WRAPPER_CLASS = 'wx-model-picker-field';
  var TRIGGER_CLASS = 'wx-model-picker-trigger';
  var PANEL_ID = 'wx-api-model-picker';
  var activeSelect = null;
  var optionObserver = null;

  function getOptions(select) {
    return Array.prototype.map.call(select.options || [], function (option) {
      return { value: option.value, label: option.textContent || option.value };
    });
  }

  function selectedOption(select) {
    return select.options && select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
  }

  function updateTrigger(select) {
    var wrapper = select && select.closest('.' + WRAPPER_CLASS);
    var trigger = wrapper && wrapper.querySelector('.' + TRIGGER_CLASS);
    var current = selectedOption(select);
    if (!trigger) return;
    trigger.querySelector('.wx-model-picker-label').textContent = current ? current.textContent : '-- 请先拉取模型 --';
    trigger.setAttribute('aria-label', '当前模型：' + (current ? current.textContent : '未选择'));
  }

  function closePicker() {
    var panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.remove();
    if (activeSelect) {
      var trigger = activeSelect.closest('.' + WRAPPER_CLASS)?.querySelector('.' + TRIGGER_CLASS);
      if (trigger) {
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus({ preventScroll: true });
      }
    }
    activeSelect = null;
  }

  function checkMark(isCurrent) {
    var mark = document.createElement('span');
    mark.className = 'wx-model-picker-check';
    mark.setAttribute('aria-hidden', 'true');
    mark.innerHTML = isCurrent ? '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" style="vertical-align:-1px"><path d="M2.5 8.5l3.5 3.5 7-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '';
    return mark;
  }

  function openPicker(select, trigger) {
    closePicker();
    activeSelect = select;

    var panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'wx-model-picker';
    panel.setAttribute('role', 'presentation');

    var sheet = document.createElement('section');
    sheet.className = 'fb-model-sheet wx-model-picker-sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', PANEL_ID + '-title');

    var handle = document.createElement('div');
    handle.className = 'fb-sheet-handle';
    handle.setAttribute('aria-hidden', 'true');
    sheet.appendChild(handle);

    var head = document.createElement('div');
    head.className = 'fb-sheet-head';
    var titleWrap = document.createElement('div');
    var title = document.createElement('div');
    title.id = PANEL_ID + '-title';
    title.className = 'fb-sheet-title';
    title.textContent = '选择 API 模型';
    var current = document.createElement('div');
    current.className = 'fb-sheet-current';
    current.textContent = '当前：' + (selectedOption(select)?.textContent || '未选择');
    titleWrap.appendChild(title);
    titleWrap.appendChild(current);
    head.appendChild(titleWrap);

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'fb-sheet-close';
    close.textContent = '关闭';
    close.setAttribute('aria-label', '关闭模型选择器');
    close.addEventListener('click', closePicker);
    head.appendChild(close);
    sheet.appendChild(head);

    var list = document.createElement('div');
    list.className = 'fb-model-list wx-model-picker-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'API 模型列表');
    var options = getOptions(select);
    options.forEach(function (item, index) {
      var option = document.createElement('button');
      option.type = 'button';
      option.className = 'fb-model-option wx-model-picker-option';
      option.dataset.value = item.value;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(select.value === item.value));
      option.setAttribute('tabindex', select.value === item.value ? '0' : '-1');
      option.appendChild(document.createTextNode(item.label));
      option.appendChild(checkMark(select.value === item.value));
      option.addEventListener('click', function () {
        select.value = item.value;
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        updateTrigger(select);
        closePicker();
      });
      option.addEventListener('keydown', function (event) {
        var buttons = Array.prototype.slice.call(list.querySelectorAll('button'));
        var position = buttons.indexOf(option);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          var next = event.key === 'ArrowDown' ? position + 1 : position - 1;
          if (next < 0) next = buttons.length - 1;
          if (next >= buttons.length) next = 0;
          buttons[next].focus();
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          buttons[event.key === 'Home' ? 0 : buttons.length - 1].focus();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          closePicker();
        }
      });
      list.appendChild(option);
      if (index === 0 && select.selectedIndex < 0) option.tabIndex = 0;
    });
    if (!options.length) {
      var empty = document.createElement('div');
      empty.className = 'wx-model-picker-empty';
      empty.textContent = '暂无模型，请先拉取模型';
      list.appendChild(empty);
    }
    sheet.appendChild(list);
    panel.appendChild(sheet);

    panel.addEventListener('click', function (event) {
      if (event.target === panel) closePicker();
    });
    panel.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePicker();
      }
    });
    (document.getElementById('sys-shell') || document.body).appendChild(panel);
    trigger.setAttribute('aria-expanded', 'true');
    var selectedButton = list.querySelector('[aria-selected="true"]') || list.querySelector('button');
    if (selectedButton) selectedButton.focus({ preventScroll: true });
  }

  function enhance(select) {
    if (!select || select.dataset.wxModelPickerReady === 'true') return;
    select.dataset.wxModelPickerReady = 'true';
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    var wrapper = document.createElement('div');
    wrapper.className = WRAPPER_CLASS;
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = TRIGGER_CLASS;
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', PANEL_ID);
    trigger.innerHTML = '<span class="wx-model-picker-label"></span><span class="wx-model-picker-chevron" aria-hidden="true"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" style="vertical-align:-1px"><path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
    trigger.addEventListener('click', function () { openPicker(select, trigger); });
    wrapper.insertBefore(trigger, select);
    select.addEventListener('change', function () { updateTrigger(select); });
    updateTrigger(select);

    if (optionObserver) optionObserver.disconnect();
    optionObserver = new MutationObserver(function () {
      updateTrigger(select);
      var panel = document.getElementById(PANEL_ID);
      if (panel && activeSelect === select) closePicker();
    });
    optionObserver.observe(select, { childList: true, subtree: true, characterData: true });
  }

  function scan() {
    var select = document.querySelector(SELECTOR);
    if (select) enhance(select);
  }

  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && document.getElementById(PANEL_ID)) closePicker();
  });
})();
