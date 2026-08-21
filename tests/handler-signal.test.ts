import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSync } from '@babel/core';
import syntaxJsx from '@babel/plugin-syntax-jsx';
import type { JSXElement, JSXOpeningElement } from '@babel/types';

import { deriveHandlerSignal } from '../src/id/handler-signal';

/** Parse a single JSX element and return its opening element. */
function open(jsx: string): JSXOpeningElement {
  const ast = parseSync(jsx, {
    babelrc: false,
    configFile: false,
    plugins: [syntaxJsx],
    parserOpts: { plugins: ['jsx'] },
  });
  let found: JSXOpeningElement | null = null;
  // The program body is an ExpressionStatement wrapping the JSXElement.
  const stmt = (ast as { program: { body: unknown[] } }).program.body[0] as {
    expression: JSXElement;
  };
  found = stmt.expression.openingElement;
  if (!found) throw new Error('no JSX element parsed');
  return found;
}

function signal(jsx: string): string | null {
  return deriveHandlerSignal(open(jsx));
}

test('named handler: strips handle/on prefix', () => {
  assert.equal(signal(`<button onClick={handleSubmit} />`), 'submit');
  assert.equal(signal(`<button onClick={onClose} />`), 'close');
});

test('camelCase handler becomes dashed', () => {
  assert.equal(signal(`<button onClick={scrollNext} />`), 'scroll-next');
  assert.equal(signal(`<button onClick={onPrevButtonClick} />`), 'prev-button-click');
});

test('member expression: receiver names the intent', () => {
  assert.equal(signal(`<button onClick={datePicker.open} />`), 'date-picker');
  assert.equal(signal(`<button onClick={markerTypePicker.open} />`), 'marker-type-picker');
});

test('arrow with string arg: literal wins over callee', () => {
  assert.equal(signal(`<button onClick={() => setDateType("today")} />`), 'today');
  assert.equal(signal(`<button onClick={() => { setDateType("tomorrow"); f(x); }} />`), 'tomorrow');
});

test('arrow without meaningful string arg: falls to callee', () => {
  assert.equal(signal(`<button onClick={() => setIsOpen(true)} />`), 'set-is-open');
  assert.equal(signal(`<button onClick={() => onDotButtonClick(index)} />`), 'dot-button-click');
});

test('first call in source order wins', () => {
  assert.equal(signal(`<button onClick={() => { pick("first"); pick("second"); }} />`), 'first');
});

test('short / meaningless handlers are rejected', () => {
  assert.equal(signal(`<button onClick={s} />`), null);
  assert.equal(signal(`<button onClick={fn} />`), null);
  assert.equal(signal(`<button onClick={cb} />`), null);
});

test('handler priority: onClick before onChange', () => {
  assert.equal(
    signal(`<input onChange={handleChange} onClick={handleFocus} />`),
    'focus'
  );
});

test('no handler yields null', () => {
  assert.equal(signal(`<button className="x" />`), null);
});
