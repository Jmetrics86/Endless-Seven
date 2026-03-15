/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TEMPORARY: Zone/label tuning GUI. Remove this file and the createZoneTuningGui()
 * call from GameController when done; then replace zoneTuningParams in GameController
 * with the final constant values you copied from "Recommended final code".
 */

import type { GameController } from './GameController';
import type { ZoneTuningParams } from './GameController';

const STYLE = `
  position: fixed;
  top: 10px;
  right: 10px;
  width: 320px;
  max-height: 90vh;
  overflow-y: auto;
  background: rgba(20, 20, 28, 0.95);
  border: 1px solid #444;
  border-radius: 8px;
  padding: 12px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: #e0e0e0;
  z-index: 10000;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
`;
const ROW = 'display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px;';
const INPUT = 'width: 72px; padding: 4px; background: #2a2a32; border: 1px solid #555; color: #fff; border-radius: 4px;';

function input(
  label: string,
  key: keyof ZoneTuningParams,
  controller: GameController,
  step: string = '0.1'
): HTMLDivElement {
  const row = document.createElement('div');
  row.setAttribute('style', ROW);
  const lab = document.createElement('label');
  lab.textContent = label;
  lab.setAttribute('style', 'min-width: 90px;');
  const num = document.createElement('input');
  num.type = 'number';
  num.step = step;
  num.setAttribute('style', INPUT);
  (num as HTMLInputElement).value = String((controller.zoneTuningParams as any)[key]);
  num.addEventListener('input', () => {
    const v = Number((num as HTMLInputElement).value);
    if (!Number.isNaN(v)) {
      (controller.zoneTuningParams as any)[key] = v;
      controller.applyZoneTuning();
      updateCodeOutput(controller, codePre);
    }
  });
  row.appendChild(lab);
  row.appendChild(num);
  return row;
}

function updateCodeOutput(controller: GameController, codePre: HTMLPreElement): void {
  const p = controller.zoneTuningParams;
  codePre.textContent = `// Paste into GameController (replace zoneTuningParams default or createPile/setupPiles literals):
  labelWidth: ${p.labelWidth},
  labelHeight: ${p.labelHeight},
  labelOffsetZ: ${p.labelOffsetZ},
  deckX: ${p.deckX},
  deckZ: ${p.deckZ},
  deckY: ${p.deckY},
  limboX: ${p.limboX},
  limboZ: ${p.limboZ},
  limboY: ${p.limboY},
  graveX: ${p.graveX},
  graveZ: ${p.graveZ},
  graveY: ${p.graveY},`;
}

export function createZoneTuningGui(controller: GameController): () => void {
  const wrap = document.createElement('div');
  wrap.setAttribute('style', STYLE);

  const title = document.createElement('div');
  title.textContent = 'Zone tuning (temporary)';
  title.setAttribute('style', 'font-weight: bold; margin-bottom: 10px; font-size: 13px;');
  wrap.appendChild(title);

  const sub1 = document.createElement('div');
  sub1.setAttribute('style', 'margin-bottom: 8px; color: #aaa; font-size: 11px;');
  sub1.textContent = 'Label';
  wrap.appendChild(sub1);
  wrap.appendChild(input('Label width', 'labelWidth', controller));
  wrap.appendChild(input('Label height', 'labelHeight', controller));
  wrap.appendChild(input('Label offset Z', 'labelOffsetZ', controller));

  const sub2 = document.createElement('div');
  sub2.setAttribute('style', 'margin: 12px 0 8px; color: #aaa; font-size: 11px;');
  sub2.textContent = 'Deck zone position';
  wrap.appendChild(sub2);
  wrap.appendChild(input('deckX', 'deckX', controller));
  wrap.appendChild(input('deckZ', 'deckZ', controller));
  wrap.appendChild(input('deckY', 'deckY', controller, '0.01'));

  const sub3 = document.createElement('div');
  sub3.setAttribute('style', 'margin: 12px 0 8px; color: #aaa; font-size: 11px;');
  sub3.textContent = 'Limbo zone position';
  wrap.appendChild(sub3);
  wrap.appendChild(input('limboX', 'limboX', controller));
  wrap.appendChild(input('limboZ', 'limboZ', controller));
  wrap.appendChild(input('limboY', 'limboY', controller, '0.01'));

  const sub4 = document.createElement('div');
  sub4.setAttribute('style', 'margin: 12px 0 8px; color: #aaa; font-size: 11px;');
  sub4.textContent = 'Grave zone position';
  wrap.appendChild(sub4);
  wrap.appendChild(input('graveX', 'graveX', controller));
  wrap.appendChild(input('graveZ', 'graveZ', controller));
  wrap.appendChild(input('graveY', 'graveY', controller, '0.01'));

  const codeLabel = document.createElement('div');
  codeLabel.setAttribute('style', 'margin: 14px 0 6px; color: #8f8; font-size: 11px;');
  codeLabel.textContent = 'Recommended final code (copy when done, then remove this GUI):';
  wrap.appendChild(codeLabel);
  const codePre = document.createElement('pre');
  codePre.setAttribute('style', 'background: #1a1a22; padding: 8px; border-radius: 4px; font-size: 10px; overflow-x: auto; white-space: pre-wrap; word-break: break-all; margin: 0;');
  wrap.appendChild(codePre);
  updateCodeOutput(controller, codePre);

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copy to clipboard';
  copyBtn.setAttribute('style', 'margin-top: 8px; padding: 6px 10px; background: #334; border: 1px solid #555; color: #ddd; border-radius: 4px; cursor: pointer; font-size: 11px;');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(codePre.textContent || '').then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy to clipboard'; }, 1500);
    });
  });
  wrap.appendChild(copyBtn);

  document.body.appendChild(wrap);

  return () => {
    if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
  };
}
