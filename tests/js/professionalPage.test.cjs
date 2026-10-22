const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,
  '../../src/MedAnnotateApp.Presentation/wwwroot/js/professionalPage.js'), 'utf8');

class Element {
  constructor(text = '', keyword) {
    this.textContent = text;
    this.value = '';
    this.dataset = keyword ? {keyword} : {};
    this.listeners = {};
    this.attributes = {};
    const classes = new Set();
    this.classList = {
      add: name => classes.add(name),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name)
    };
  }
  addEventListener(name, callback) {
    (this.listeners[name] ||= []).push(callback);
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  async fire(name, event = {}) {
    for (const callback of this.listeners[name] || []) await callback(event);
  }
  click() { return this.fire('click'); }
}

async function page(occurrences, expectedCount) {
  const elements = Object.fromEntries(['annotation-status', 'next-button', 'skip-button',
    'not-present-button', 'comments', 'image-container'].map(id => [id, new Element()]));
  const header = new Element();
  header.dataset.keywordCount = String(expectedCount);
  let onReady;
  const calls = [];
  class CanvasManager {
    constructor() {
      this.canvas = new Element();
      this.ready = true;
      this.annotations = [];
      this.currentAction = 'none';
    }
    createTools() {
      return {rectButton: new Element(), freehandButton: new Element(), magnifyButton: new Element()};
    }
    resetAnnotation() { this.annotations = []; }
    getAllAnnotationsJSON() { return 'synthetic image-coordinate envelope'; }
    loadCoordinates(coordinates) { this.loaded = coordinates; }
  }
  const context = {
    window: {annotatedMedData: {id: 1}, addEventListener() {}},
    document: {
      addEventListener(name, callback) { if (name === 'DOMContentLoaded') onReady = callback; },
      getElementById: id => elements[id],
      querySelectorAll: selector => selector === '.header-text .keyword' ? occurrences : [],
      querySelector: selector => selector === '.header-text' ? header : {value: 'synthetic-csrf'}
    },
    CanvasManager, confirm: () => true,
    location: {reload() {}},
    fetch: async (url, options = {}) => {
      calls.push({url, ...options});
      return {ok: true, json: async () => url.includes('CurrentAnnotations') ? {annotations: []} : {success: true}};
    }
  };
  vm.runInNewContext(source, context, {filename: 'professionalPage.js'});
  onReady();
  await new Promise(setImmediate);
  return {elements, calls, manager: context.window.canvasManager};
}

test('inline repeated phrases advance once per canonical term in description order', async () => {
  const firstBoundary = new Element('Boundary', 'boundary');
  const lesion = new Element('LESION', 'lesion');
  const repeatedBoundary = new Element('boundary', 'boundary');
  const {elements, calls, manager} = await page([firstBoundary, lesion, repeatedBoundary], 2);
  assert.equal(firstBoundary.classList.contains('current_keyword'), true);
  assert.equal(repeatedBoundary.classList.contains('current_keyword'), true);
  assert.equal(lesion.classList.contains('not_annotated_keyword'), true);

  manager.annotations = [{syntheticShape: true}];
  manager.onAnnotationsChange();
  await elements['next-button'].click();
  assert.equal(firstBoundary.classList.contains('annotated_keyword'), true);
  assert.equal(repeatedBoundary.classList.contains('annotated_keyword'), true);
  assert.equal(lesion.classList.contains('current_keyword'), true);

  await repeatedBoundary.click();
  assert.equal(manager.readOnly, true, 'Repeated saved phrase opens the same saved response');
  assert.equal(manager.loaded, 'synthetic image-coordinate envelope');
  await lesion.click();
  assert.equal(manager.readOnly, false);
  manager.annotations = [{syntheticShape: true}];
  manager.onAnnotationsChange();
  await elements['next-button'].click();

  const saves = calls.filter(call => call.url === '/MedData/ProcessAnnotatedMedData');
  assert.deepEqual(saves.map(call => JSON.parse(call.body).ExtractedKeyword), ['boundary', 'lesion']);
  assert.equal(elements['next-button'].textContent, 'Next Image');
  assert.equal(elements['skip-button'].disabled, true);
});

test('a missing description keyword blocks annotation and completion controls', async () => {
  const {elements, calls, manager} = await page([new Element('lesion', 'lesion')], 2);
  assert.equal(elements['annotation-status'].dataset.state, 'error');
  assert.match(elements['annotation-status'].textContent, /refine this image's keywords/);
  assert.equal(elements['next-button'].disabled, true);
  assert.equal(elements['skip-button'].disabled, true);
  assert.equal(elements['not-present-button'].disabled, true);
  assert.equal(manager.readOnly, true);
  assert.equal(calls.length, 0, 'Incomplete terms must not trigger annotation API calls');
});
