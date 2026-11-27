/* 小未来 · WeChat / 全局 API 模型触屏选择器
 * 原生 select（#wx-edit-api-model / #ga-model）仍是唯一值源；本脚本只提供触摸/键盘交互层。
 * 两级选择：先选供应商（DeepSeek、OpenAI、Anthropic……），点进去再选型号；
 * 供应商按模型 id 前缀推断，认不出的进「其他」。
 */
(function () {
  'use strict';

  var SELECTORS = '#wx-edit-api-model, #ga-model';
  var WRAPPER_CLASS = 'wx-model-picker-field';
  var TRIGGER_CLASS = 'wx-model-picker-trigger';
  var PANEL_ID = 'wx-api-model-picker';
  var activeSelect = null;

  /* 供应商顺序：DeepSeek 在最前；「其他」永远最后 */
  var PROVIDER_ORDER = ['deepseek', 'openai', 'anthropic', 'google', 'qwen', 'moonshot', 'glm', 'yi', 'minimax', 'xai', 'meta', 'mistral', 'other'];
  var PROVIDERS = {
    deepseek: 'DeepSeek',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    qwen: '通义千问',
    moonshot: 'Moonshot',
    glm: '智谱',
    yi: '零一万物',
    minimax: 'MiniMax',
    xai: 'xAI',
    meta: 'Meta',
    mistral: 'Mistral',
    other: '其他'
  };

  function providerOf(value) {
    var v = String(value || '').toLowerCase();
    if (/^deepseek/.test(v)) return 'deepseek';
    if (/^(gpt-|o1|o3)/.test(v)) return 'openai';
    if (/^claude/.test(v)) return 'anthropic';
    if (/^gemini/.test(v)) return 'google';
    if (/^qwen/.test(v)) return 'qwen';
    if (/^moonshot/.test(v)) return 'moonshot';
    if (/^glm/.test(v)) return 'glm';
    if (/^yi[-_]/.test(v)) return 'yi';
    if (/^abab/.test(v)) return 'minimax';
    if (/^grok/.test(v)) return 'xai';
    if (/^llama/.test(v)) return 'meta';
    if (/^mistral/.test(v)) return 'mistral';
    return 'other';
  }

  /* 按供应商分组；空 value 的占位项（「点击选择或拉取」）不是模型，不进列表 */
  function groupModels(select) {
    var groups = {};
    Array.prototype.forEach.call(select.options || [], function (option) {
      var value = option.value;
      if (!value) return;
      var pid = providerOf(value);
      if (!groups[pid]) groups[pid] = [];
      groups[pid].push({ value: value, label: option.textContent || value });
    });
    return PROVIDER_ORDER.filter(function (pid) { return groups[pid] && groups[pid].length; })
      .map(function (pid) { return { id: pid, name: PROVIDERS[pid], models: groups[pid] }; });
  }

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

  /* 列表内键盘导航：上下/Home/End 移动，Esc 关闭（对供应商级和型号级都适用） */
  function attachNav(button, list) {
    button.addEventListener('keydown', function (event) {
      var buttons = Array.prototype.slice.call(list.querySelectorAll('button'));
      var position = buttons.indexOf(button);
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
  }

  function makeOptionButton(list, label, isCurrent) {
    var option = document.createElement('button');
    option.type = 'button';
    option.className = 'fb-model-option wx-model-picker-option';
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(!!isCurrent));
    option.setAttribute('tabindex', isCurrent ? '0' : '-1');
    option.appendChild(document.createTextNode(label));
    option.appendChild(checkMark(!!isCurrent));
    attachNav(option, list);
    return option;
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
    var current = document.createElement('div');
    current.className = 'fb-sheet-current';
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
    sheet.appendChild(list);

    var groups = groupModels(select);

    function setHead(levelTitle) {
      title.textContent = levelTitle;
      current.textContent = '当前：' + (selectedOption(select)?.textContent || '未选择');
    }

    function focusSelected() {
      var selectedButton = list.querySelector('[aria-selected="true"]') || list.querySelector('button');
      if (selectedButton) selectedButton.focus({ preventScroll: true });
    }

    /* 第一级：供应商列表（带各家模型数量） */
    function renderProviders() {
      setHead('选择供应商');
      list.setAttribute('aria-label', '供应商列表');
      list.innerHTML = '';
      if (!groups.length) {
        var empty = document.createElement('div');
        empty.className = 'wx-model-picker-empty';
        empty.textContent = '暂无模型，请先拉取模型';
        list.appendChild(empty);
        return;
      }
      groups.forEach(function (group) {
        var row = document.createElement('button');
        row.type = 'button';
        row.className = 'fb-model-option wx-model-picker-option wx-model-picker-provider';
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', String(group.models.some(function (m) { return select.value === m.value; })));
        row.setAttribute('tabindex', '-1');
        var name = document.createElement('span');
        name.className = 'wx-model-picker-label';
        name.textContent = group.name;
        var count = document.createElement('span');
        count.className = 'wx-model-picker-count';
        count.textContent = group.models.length + ' 个模型';
        var chevron = document.createElement('span');
        chevron.className = 'wx-model-picker-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.textContent = '›';
        row.appendChild(name);
        row.appendChild(count);
        row.appendChild(chevron);
        attachNav(row, list);
        row.addEventListener('click', function () { renderModels(group); });
        list.appendChild(row);
      });
      focusSelected();
    }

    /* 第二级：某家供应商的型号列表，顶部可返回供应商 */
    function renderModels(group) {
      setHead(group.name);
      list.setAttribute('aria-label', group.name + ' 模型列表');
      list.innerHTML = '';
      var back = document.createElement('button');
      back.type = 'button';
      back.className = 'fb-model-option wx-model-picker-option wx-model-picker-back';
      back.textContent = '‹';
      back.setAttribute('aria-label', '全部供应商');
      attachNav(back, list);
      back.addEventListener('click', renderProviders);
      list.appendChild(back);
      group.models.forEach(function (item, index) {
        var option = makeOptionButton(list, item.label, select.value === item.value);
        option.dataset.value = item.value;
        option.addEventListener('click', function () {
          select.value = item.value;
          select.dispatchEvent(new Event('input', { bubbles: true }));
          select.dispatchEvent(new Event('change', { bubbles: true }));
          updateTrigger(select);
          closePicker();
        });
        list.appendChild(option);
        if (index === 0 && select.selectedIndex < 0) option.tabIndex = 0;
      });
      focusSelected();
    }

    renderProviders();
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

    /* 每个 select 各自的观察器：选项变化时刷新触发器文字，打开中则关掉重选 */
    if (select._wxModelPickerObserver) select._wxModelPickerObserver.disconnect();
    var observer = new MutationObserver(function () {
      updateTrigger(select);
      var panel = document.getElementById(PANEL_ID);
      if (panel && activeSelect === select) closePicker();
    });
    observer.observe(select, { childList: true, subtree: true, characterData: true });
    select._wxModelPickerObserver = observer;
  }

  function scan() {
    var selects = document.querySelectorAll(SELECTORS);
    Array.prototype.forEach.call(selects, enhance);
  }

  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && document.getElementById(PANEL_ID)) closePicker();
  });
})();
