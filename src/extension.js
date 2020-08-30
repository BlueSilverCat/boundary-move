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
  const bm = new boundary.BoundaryManager(channel, config);

  vscodeUtil.registerCommand(context, "BM.moveLeft", moveLeft);
  vscodeUtil.registerCommand(context, "BM.moveRight", moveRight);
  vscodeUtil.registerCommand(context, "BM.selectLeft", selectLeft);
  vscodeUtil.registerCommand(context, "BM.selectRight", selectRight);
  vscodeUtil.registerCommand(context, "BM.info", info);
  vscodeUtil.registerCommand(context, "BM.jump", jump);
  vscodeUtil.registerCommand(context, "BM.jumpLine", jumpLine);
  vscodeUtil.registerCommand(context, "BM.selectJump", selectJump);
  vscodeUtil.registerCommand(context, "BM.selectJumpLine", selectJumpLine);

  vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (event.affectsConfiguration("boundaryMove") === true) {
        config = vscode.workspace.getConfiguration("boundaryMove");
        bm.config(config);
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

  function jump() {
    const editor = vscode.window.activeTextEditor;
    if (vscodeUtil.isEmpty(editor) === true) {
      return;
    }
    bm.jump(editor);
  }

  function selectJump() {
    const editor = vscode.window.activeTextEditor;
    if (vscodeUtil.isEmpty(editor) === true) {
      return;
    }
    bm.jump(editor, true);
  }

  function jumpLine() {
    const editor = vscode.window.activeTextEditor;
    if (vscodeUtil.isEmpty(editor) === true) {
      return;
    }
    bm.jumpLine(editor);
  }

  function selectJumpLine() {
    const editor = vscode.window.activeTextEditor;
    if (vscodeUtil.isEmpty(editor) === true) {
      return;
    }
    bm.jumpLine(editor, true);
  }
}
exports.activate = activate;

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
