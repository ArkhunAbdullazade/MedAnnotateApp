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

async function page(occurrences, expectedCount, options = {}) {
  const loadHistory = options.loadHistory;
  const elements = Object.fromEntries(['annotation-status', 'next-button', 'skip-button',
    'not-present-button', 'comments', 'image-container'].map(id => [id, new Element()]));
  const header = new Element();
  header.dataset.keywordCount = String(expectedCount);
  let onReady;
  const calls = [];
  class CanvasManager {
    constructor() {
      this.canvas = new Element();
      this.ready = options.imageReady ?? true;
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
      if (url.includes('CurrentAnnotations') && loadHistory) return loadHistory();
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

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return {promise, resolve};
}
const historyResponse = (annotations = []) => ({ok: true, json: async () => ({annotations})});

test('saved responses begin loading before the image but controls and comments wait for both', async () => {
  const response = deferred(), term = new Element('lesion', 'lesion');
  const {elements, calls, manager} = await page([term], 1,
    {imageReady: false, loadHistory: () => response.promise});
  assert.equal(calls.length, 1, 'History fetch starts without waiting for image readiness');
  assert.equal(manager.readOnly, true);
  assert.equal(elements.comments.disabled, true, 'Loading must not accept comments that initialization would clear');
  response.resolve(historyResponse());
  await new Promise(setImmediate);
  assert.equal(manager.readOnly, true);
  assert.equal(elements.comments.disabled, true);
  assert.equal(elements['skip-button'].disabled, true);
  await elements['next-button'].click();
  assert.equal(calls.length, 1, 'No completion request is allowed before initialization');
  manager.ready = true;
  await manager.canvas.fire('annotationimageready');
  assert.equal(manager.readOnly, false);
  assert.equal(elements.comments.disabled, false);
  assert.equal(term.classList.contains('current_keyword'), true);
  assert.equal(calls.length, 1);
});

test('an image arriving first shares the in-flight fetch and restores history without resetting later drafts', async () => {
  const response = deferred(), savedTerm = new Element('lesion', 'lesion'), current = new Element('boundary', 'boundary');
  const {elements, calls, manager} = await page([savedTerm, current], 2,
    {imageReady: false, loadHistory: () => response.promise});
  manager.ready = true;
  await manager.canvas.fire('annotationimageready');
  await manager.canvas.fire('annotationimageready');
  assert.equal(calls.length, 1);
  assert.equal(manager.readOnly, true);
  assert.equal(elements.comments.disabled, true);
  response.resolve(historyResponse([{extractedKeyword: 'lesion', pressedButton: 'Save and Next Term',
    boxCoordinates: 'saved coordinate envelope', comment: 'saved comment'}]));
  await new Promise(setImmediate);
  assert.equal(current.classList.contains('current_keyword'), true);
  await savedTerm.click();
  assert.equal(manager.readOnly, true);
  assert.equal(manager.loaded, 'saved coordinate envelope');
  assert.equal(elements.comments.value, 'saved comment');
  await current.click();
  manager.annotations = [{syntheticShape: true}]; elements.comments.value = 'current draft';
  manager.onAnnotationsChange();
  await manager.canvas.fire('annotationimageready');
  assert.equal(calls.length, 1);
  assert.equal(manager.annotations.length, 1);
  assert.equal(elements.comments.value, 'current draft');
});

test('failed history loading stays locked and a later image event can retry without duplicate requests', async () => {
  const retry = deferred(); let attempts = 0;
  const {elements, calls, manager} = await page([new Element('lesion', 'lesion')], 1,
    {imageReady: false, loadHistory: () => ++attempts === 1 ?
      {ok: false, json: async () => ({success: false, message: 'This image is not assigned to you.'})} : retry.promise});
  assert.equal(elements['annotation-status'].dataset.state, 'error');
  assert.match(elements['annotation-status'].textContent, /not assigned/);
  assert.equal(manager.readOnly, true);
  manager.ready = true;
  const retryReady = manager.canvas.fire('annotationimageready');
  await manager.canvas.fire('annotationimageready');
  assert.equal(calls.length, 2, 'Only one retry may be in flight');
  assert.equal(elements['annotation-status'].dataset.state, 'error');
  assert.equal(elements.comments.disabled, true);
  assert.equal(manager.readOnly, true);
  await elements['next-button'].click();
  assert.equal(calls.length, 2);
  retry.resolve(historyResponse());
  await retryReady;
  assert.equal(manager.readOnly, false);
  assert.equal(elements['annotation-status'].dataset.state, 'ready');
});

test('finishing the history prefetch does not hide an image loading error', async () => {
  const response = deferred();
  const {elements, calls, manager} = await page([new Element('lesion', 'lesion')], 1,
    {imageReady: false, loadHistory: () => response.promise});
  elements['annotation-status'].textContent = 'This image could not be loaded.';
  elements['annotation-status'].dataset.state = 'error';
  await manager.canvas.fire('annotationimageerror');
  response.resolve(historyResponse());
  await new Promise(setImmediate);
  assert.equal(calls.length, 1);
  assert.equal(manager.readOnly, true);
  assert.equal(elements.comments.disabled, true);
  assert.equal(elements['annotation-status'].dataset.state, 'error');
  assert.match(elements['annotation-status'].textContent, /image could not be loaded/);
});
