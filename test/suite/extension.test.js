/** @type {typeof import("assert")} */
const assert = require("assert").strict;
const vscode = require("vscode");
const path = require("path");

const COMMANDS = [
  "BM.moveLeft",
  "BM.moveRight",
  "BM.selectLeft",
  "BM.selectRight",
  "BM.info",
  "BM.jump",
  "BM.jumpLine",
];
const ROOT_URI = vscode.workspace.workspaceFolders[0].uri;

async function prepare(fileName) {
  const document = await vscode.workspace.openTextDocument(path.join(ROOT_URI.fsPath, fileName));
  const editor = await vscode.window.showTextDocument(document);
  return editor;
}

let editor = null;
let activeEditor = null;
let expected = null;
describe("Extension Test Suite", function () {
  describe("activate", function () {
    it("test", async function () {
      const extension = vscode.extensions.getExtension("BlueSilverCat.boundary-move");
      assert.strictEqual(extension.isActive, true);
      const allCommands = await vscode.commands.getCommands(true);
      const commands = allCommands.filter((command) => {
        return /BM/.test(command);
      });
      assert.deepStrictEqual(commands, COMMANDS);
    });
  });

  describe("commands test", function () {
    beforeEach(async function () {
      editor = await prepare("moveTest.txt");
      activeEditor = vscode.window.activeTextEditor;
      assert.deepStrictEqual(editor, activeEditor);
    });

    describe("moveLeft", function () {
      it("test", async function () {
        activeEditor.selections = [new vscode.Selection(1, 0, 1, 0), new vscode.Selection(1, 12, 1, 12)];
        expected = [new vscode.Selection(0, 12, 0, 12), new vscode.Selection(1, 10, 1, 10)];
        await vscode.commands.executeCommand("BM.moveLeft");
        assert.deepStrictEqual(editor.selections, expected);
      });
    });

    describe("moveRight", function () {
      it("test", async function () {
        activeEditor.selections = [new vscode.Selection(1, 0, 1, 0), new vscode.Selection(1, 12, 1, 12)];
        expected = [new vscode.Selection(1, 2, 1, 2), new vscode.Selection(2, 0, 2, 0)];
        await vscode.commands.executeCommand("BM.moveRight");
        assert.deepStrictEqual(editor.selections, expected);
      });
    });

    describe("selectLeft", function () {
      it("test", async function () {
        activeEditor.selections = [new vscode.Selection(1, 0, 1, 0), new vscode.Selection(1, 12, 1, 12)];
        expected = [new vscode.Selection(1, 0, 0, 12), new vscode.Selection(1, 12, 1, 10)];
        await vscode.commands.executeCommand("BM.selectLeft");
        assert.deepStrictEqual(editor.selections, expected);
      });
    });

    describe("selectRight", function () {
      it("test", async function () {
        activeEditor.selections = [new vscode.Selection(1, 0, 1, 0), new vscode.Selection(1, 12, 1, 12)];
        expected = [new vscode.Selection(1, 0, 1, 2), new vscode.Selection(1, 12, 2, 0)];
        await vscode.commands.executeCommand("BM.selectRight");
        assert.deepStrictEqual(editor.selections, expected);
      });
    });

    describe.skip("info", function () {
      it("pendding", async function () {
        // await vscode.commands.executeCommand("BM.info");
      });
    });

    describe.skip("jump", function () {
      it("pennding", async function () {
        // await vscode.commands.executeCommand("BM.jump");
      });
    });

    describe.skip("jumpLine", function () {
      it("pannding", async function () {
        // await vscode.commands.executeCommand("BM.jump");
      });
    });
  });
});
