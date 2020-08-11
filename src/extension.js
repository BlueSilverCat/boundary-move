const vscode = require("vscode");
const boundary = require("./boundary.js");
const vscodeUtil = require("./vscodeUtil.js");

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const name = "BoundaryMove";
  const channel = vscode.window.createOutputChannel(`${name}`);
  channel.appendLine(`${name}: activate`);
  let config = vscode.workspace.getConfiguration("boundaryMove");
  let jumpZoomOutLevel = config.get("jumpZoomOutLevel", 1);
  const bm = new boundary.BoundaryManager(channel, config);

  vscodeUtil.registerCommand(context, "BM.moveLeft", moveLeft);
  vscodeUtil.registerCommand(context, "BM.moveRight", moveRight);
  vscodeUtil.registerCommand(context, "BM.selectLeft", selectLeft);
  vscodeUtil.registerCommand(context, "BM.selectRight", selectRight);
  vscodeUtil.registerCommand(context, "BM.info", info);
  vscodeUtil.registerCommand(context, "BM.jump", jump);
  vscodeUtil.registerCommand(context, "BM.jumpLine", jumpLine);

  vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (event.affectsConfiguration("boundaryMove") === true) {
        config = vscode.workspace.getConfiguration("boundaryMove");
        bm.config(config);
        jumpZoomOutLevel = config.get("jumpZoomOutLevel", 1);
      }
    },
    null,
    context.subscriptions
  );

  vscode.workspace.onDidOpenTextDocument(
    (document) => {
      bm.add(document);
    },
    null,
    context.subscriptions
  );
  vscode.workspace.onDidCloseTextDocument(
    (document) => {
      bm.delete(document);
    },
    null,
    context.subscriptions
  );
  vscode.workspace.onDidChangeTextDocument(
    (event) => {
      bm.change(event);
    },
    null,
    context.subscriptions
  );

  function moveLeft() {
    const editor = vscode.window.activeTextEditor;
    if (typeof editor === "undefined") {
      return;
    }
    bm.move(editor, true);
  }

  function moveRight() {
    const editor = vscode.window.activeTextEditor;
    if (typeof editor === "undefined") {
      return;
    }
    bm.move(editor, false);
  }

  function selectLeft() {
    const editor = vscode.window.activeTextEditor;
    if (typeof editor === "undefined") {
      return;
    }
    bm.select(editor, true);
  }

  function selectRight() {
    const editor = vscode.window.activeTextEditor;
    if (typeof editor === "undefined") {
      return;
    }
    bm.select(editor, false);
  }

  function info() {
    bm.info();
  }

  async function jump() {
    const editor = vscode.window.activeTextEditor;
    if (vscodeUtil.isEmpty(editor) === true) {
      return;
    }

    if (jumpZoomOutLevel > 0) {
      await vscodeUtil.fontZoomOut(jumpZoomOutLevel);
    }
    const { documentIndex, start, end } = bm.getVisibleRange(editor);
    if (documentIndex === -1 || end - start <= 0) {
      if (jumpZoomOutLevel > 0) {
        await vscodeUtil.fontZoomIn(jumpZoomOutLevel);
      }
      return;
    }
    const decorationRanges = bm.getDecorationRanges(documentIndex, start, end);
    const decorationTypes = setDecorations(editor, decorationRanges);
    const result = await showBoundaryInputRange(decorationRanges);
    decorationTypes.dispose();
    if (jumpZoomOutLevel > 0) {
      await vscodeUtil.fontZoomIn(jumpZoomOutLevel);
    }
    if (result === null) {
      return;
    }

    bm.jump(editor, documentIndex, result.lineIndex, result.count);
    return;
  }

  async function jumpLine() {
    const editor = vscode.window.activeTextEditor;
    if (vscodeUtil.isEmpty(editor) === true) {
      return;
    }

    const { documentIndex, lineCount } = bm.getLineCount(editor);
    if (documentIndex === -1 || lineCount <= 0) {
      return;
    }
    if (jumpZoomOutLevel > 0) {
      await vscodeUtil.fontZoomOut(jumpZoomOutLevel);
    }
    const lineIndex = await showLineInput(lineCount, editor.selection.active.line);
    if (lineIndex === -1) {
      if (jumpZoomOutLevel > 0) {
        await vscodeUtil.fontZoomIn(jumpZoomOutLevel);
      }
      return;
    }

    const lineDecorationRanges = bm.getLineDecorationRanges(documentIndex, lineIndex);
    const decorationTypes = setDecorations(editor, [lineDecorationRanges]);
    const count = await showBoundaryInput(lineDecorationRanges);
    decorationTypes.dispose();
    if (jumpZoomOutLevel > 0) {
      await vscodeUtil.fontZoomIn(jumpZoomOutLevel);
    }
    if (count === -1) {
      return;
    }

    bm.jump(editor, documentIndex, lineIndex, count);
  }

  /**
   * @param {number} lineCount
   */
  async function showLineInput(lineCount, currntLine) {
    const rangeString = `range: 1 -- ${lineCount}`;
    const line = (currntLine + 1).toString(10);
    const result = await vscode.window.showInputBox({
      placeHolder: rangeString,
      prompt: `Input line index for jump. ${rangeString}`,
      value: line,
      valueSelection: [0, line.length],
    });
    if (vscodeUtil.isEmpty(result) === true) {
      return -1;
    }
    let lineIndex = parseInt(result, 10) - 1;
    if (lineIndex < 0) {
      lineIndex = 0;
    } else if (lineIndex >= lineCount) {
      lineIndex = lineCount - 1;
    }
    return lineIndex;
  }

  /**
   * @param {{range: import("vscode").Range, textContent: string, index: number}[]} lineDecorationRanges
   */
  async function showBoundaryInput(lineDecorationRanges) {
    const rangeString = `range: a -- ${bm.converter.convertToString(lineDecorationRanges.length - 1)}`;
    const result = await vscode.window.showInputBox({
      placeHolder: rangeString,
      prompt: `Input boundary index for jump. ${rangeString}`,
      value: "a",
    });
    if (vscodeUtil.isEmpty(result) === true) {
      return -1;
    }
    let i = bm.converter.convertToNumber(result);
    let count = 0;
    if (i < 0) {
      count = lineDecorationRanges[0].index;
    } else if (i >= lineDecorationRanges.length) {
      count = lineDecorationRanges[lineDecorationRanges.length - 1].index;
    } else {
      count = lineDecorationRanges[i].index;
    }
    return count;
  }

  async function showBoundaryInputRange(decorationRanges) {
    const rangeString = `range: aa -- ${decorationRanges[decorationRanges.length - 1][decorationRanges[decorationRanges.length - 1].length - 1].textContent}`;
    const input = await vscode.window.showInputBox({
      placeHolder: rangeString,
      prompt: `Input boundary index for jump. ${rangeString}`,
    });
    if (vscodeUtil.isEmpty(input) === true) {
      return null;
    }
    return bm.search(decorationRanges, input);
  }

  /**
   * @param {import("vscode").TextEditor} editor
   * @param {{range: import("vscode").Range, textContent: string, index: number}[][]} decoratonRanges
   */
  function setDecorations(editor, decoratonRanges) {
    const decorationType = vscode.window.createTextEditorDecorationType({});
    const options = [];
    for (const lineDecorationRanges of decoratonRanges) {
      for (const option of lineDecorationRanges) {
        options.push({
          range: option.range,
          renderOptions: {
            before: {
              contentText: option.textContent,
              margin: bm.MarkerMargin,
              fontStyle: "normal",
              fontWeight: "normal",
              color: { id: "boundaryMove.markerColor" },
              backgroundColor: { id: "boundaryMove.markerBackgroundColor" },
            },
          },
        });
      }
    }
    editor.setDecorations(decorationType, options);
    return decorationType;
  }
}
exports.activate = activate;

function deactivate() { }

module.exports = {
  activate,
  deactivate,
};
