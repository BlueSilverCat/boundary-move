/** @type {typeof import("assert")} */
const assert = require("assert").strict;
const vscode = require("vscode");
const path = require("path");
const vscodeUtil = require("../../src/vscodeUtil.js");

const FILE_NAME0 = "vscodeUtil0.txt";
const FILE_NAME1 = "vscodeUtil1.txt";
const FILE_NAME2 = "vscodeUtil2.txt";
const FILE_NAME3 = "vscodeUtil3.txt";
const FILE_NAME4 = "vscodeUtil4.txt";
const FILE4 = "01: abcdef\n02: 123456\n03: ghijkl\n04: 789012\n";

const ROOT_URI = vscode.workspace.workspaceFolders[0].uri;
async function prepare(fileName) {
  const document = await vscode.workspace.openTextDocument(path.join(ROOT_URI.fsPath, fileName));
  const editor = await vscode.window.showTextDocument(document);
  return { document, editor };
}

// async function testFunc() {
//   console.log(ROOT_URI);
//   let document = await vscode.workspace.openTextDocument(path.join(ROOT_URI.fsPath, "vscodeUtil0.txt"));
//   console.log(document.uri);
//   let uri = vscode.Uri.file("vscodeUtil0.txt");
//   console.log(uri);
//   document = await vscode.workspace.openTextDocument(uri);
//   console.log(document);
//   document = await vscode.workspace.openTextDocument("vscodeUtil0.txt");
//   console.log(document);
//   document = await vscode.workspace.openTextDocument("vscodeUtil1.txt");
//   console.log(document);
// }

describe("VscodeUtil Test Suite 1", function () {
  let actual = null;
  let expected = null;

  beforeEach(function () {
    actual = null;
    expected = null;
  });

  describe("isEmpty", function () {
    it("return true", function () {
      assert.strictEqual(vscodeUtil.isEmpty(null), true);
      assert.strictEqual(vscodeUtil.isEmpty(undefined), true);
      assert.strictEqual(vscodeUtil.isEmpty(""), true);
      assert.strictEqual(vscodeUtil.isEmpty({}), true);
    });
    it("return false", function () {
      assert.strictEqual(vscodeUtil.isEmpty("abc"), false);
      assert.strictEqual(vscodeUtil.isEmpty(0), false);
      assert.strictEqual(vscodeUtil.isEmpty({ a: 1, b: 2 }), false);
    });
  });

  describe("subLimit", function () {
    it("not limit", function () {
      assert.strictEqual(vscodeUtil.subLimit(10, 5), 5);
      assert.strictEqual(vscodeUtil.subLimit(10, 10), 0);
    });
    it("limit", function () {
      assert.strictEqual(vscodeUtil.subLimit(10, 15), 0);
      assert.strictEqual(vscodeUtil.subLimit(10, 10, 5), 5);
    });
  });

  describe("addLimit", function () {
    it("not limit", function () {
      assert.strictEqual(vscodeUtil.addLimit(10, 5, 20), 15);
      assert.strictEqual(vscodeUtil.addLimit(10, 10, 20), 20);
    });
    it("limit", function () {
      assert.strictEqual(vscodeUtil.addLimit(10, 15), 0);
      assert.strictEqual(vscodeUtil.addLimit(10, 10, 5), 5);
    });
  });
  describe("isSameObj", function () {
    it("true", function () {
      assert.strictEqual(vscodeUtil.isSameObj([1, 2, 3], [1, 2, 3]), true);
      assert.strictEqual(vscodeUtil.isSameObj(["1", "2", "3"], ["1", "2", "3"]), true);
      assert.strictEqual(vscodeUtil.isSameObj([{ a: 1 }, { b: 2 }, { c: 3 }], [{ a: 1 }, { b: 2 }, { c: 3 }]), true);
      assert.strictEqual(vscodeUtil.isSameObj({ a: 1, b: 2 }, { a: 1, b: 2 }), true);
      assert.strictEqual(vscodeUtil.isSameObj({ a: "1", b: 2 }, { a: "1", b: 2 }), true);
      assert.strictEqual(vscodeUtil.isSameObj({ a: 1, b: [1, 2, 3] }, { a: 1, b: [1, 2, 3] }), true);
    });
    it("false", function () {
      assert.strictEqual(vscodeUtil.isSameObj([0, 1, 2], [1, 2, 3]), false);
      assert.strictEqual(vscodeUtil.isSameObj([1, 2, 3, 4], [1, 2, 3]), false);
      assert.strictEqual(vscodeUtil.isSameObj([1, 2, 3], [1, 2, 3, 4]), false);
      assert.strictEqual(vscodeUtil.isSameObj(["1", "0", "3"], ["1", "2", "3"]), false);
      assert.strictEqual(vscodeUtil.isSameObj([{ a: 1 }, { b: 2 }, { c: 4 }], [{ a: 1 }, { b: 2 }, { c: 3 }]), false);
      assert.strictEqual(vscodeUtil.isSameObj([{ a: 1 }, { d: 2 }, { c: 3 }], [{ a: 1 }, { b: 2 }, { c: 3 }]), false);
      assert.strictEqual(vscodeUtil.isSameObj({ a: 1, b: 2 }, { a: 1, b: 3 }), false);
      assert.strictEqual(vscodeUtil.isSameObj({ b: 1, a: 2 }, { a: 2, b: 1 }), false); // fix
      assert.strictEqual(vscodeUtil.isSameObj({ a: "1", b: 2 }, { a: "2", b: 2 }), false);
      assert.strictEqual(vscodeUtil.isSameObj({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2, 3] }), false);
    });
  });

  describe("sortKey", function () {
    it("true", function () {
      actual = JSON.stringify(vscodeUtil.sortKey({ a: 1, b: 2, c: 3 }));
      expected = JSON.stringify({ a: 1, b: 2, c: 3 });
      assert.strictEqual(actual, expected);

      actual = JSON.stringify(vscodeUtil.sortKey({ c: 3, b: 2, a: 1 }));
      expected = JSON.stringify({ a: 1, b: 2, c: 3 });
      assert.strictEqual(actual, expected);
    });
    it("false", function () {
      actual = JSON.stringify(vscodeUtil.sortKey({ c: 1, b: 2, a: 3 }));
      expected = JSON.stringify({ a: 1, b: 2, c: 3 });
      assert.notStrictEqual(actual, expected);

      actual = JSON.stringify(vscodeUtil.sortKey({ c: 1, b: 2, a: 3 }));
      expected = JSON.stringify({ c: 1, b: 2, a: 3 });
      assert.notStrictEqual(actual, expected);
    });
  });

  describe("uniquePush", function () {
    it("not duplication", function () {
      assert.deepStrictEqual(vscodeUtil.uniquePush([1, 2, 3], 4), [1, 2, 3, 4]);
      assert.deepStrictEqual(vscodeUtil.uniquePush([1, 2, 3], 0), [1, 2, 3, 0]);
    });
    it("duplication", function () {
      assert.deepStrictEqual(vscodeUtil.uniquePush([1, 2, 3], 3), [1, 2, 3]);
      assert.deepStrictEqual(vscodeUtil.uniquePush([1, 2, 3], 2), [1, 2, 3]);
    });
  });

  describe("convertToString", function () {
    it("test", function () {
      assert.deepStrictEqual(vscodeUtil.convertToString(0), "a");
      assert.deepStrictEqual(vscodeUtil.convertToString(25), "z");
      assert.deepStrictEqual(vscodeUtil.convertToString(26), "aa");
      assert.deepStrictEqual(vscodeUtil.convertToString(51), "az");
      assert.deepStrictEqual(vscodeUtil.convertToString(52), "ba");
      assert.deepStrictEqual(vscodeUtil.convertToString(52), "ba");
      assert.deepStrictEqual(vscodeUtil.convertToString(701), "zz");
      assert.deepStrictEqual(vscodeUtil.convertToString(702), "aaa");
      assert.deepStrictEqual(vscodeUtil.convertToString(727), "aaz");
      assert.deepStrictEqual(vscodeUtil.convertToString(728), "aba");
    });
  });

  describe("convertToNumber", function () {
    it("test", function () {
      assert.deepStrictEqual(vscodeUtil.convertToNumber("a"), 0);
      assert.deepStrictEqual(vscodeUtil.convertToNumber("z"), 25);
      assert.deepStrictEqual(vscodeUtil.convertToNumber("aa"), 26);
      assert.deepStrictEqual(vscodeUtil.convertToNumber("az"), 51);
      assert.deepStrictEqual(vscodeUtil.convertToNumber("ba"), 52);
      assert.deepStrictEqual(vscodeUtil.convertToNumber("ba"), 52);
      assert.deepStrictEqual(vscodeUtil.convertToNumber("zz"), 701);
      assert.deepStrictEqual(vscodeUtil.convertToNumber("aaa"), 702);
      assert.deepStrictEqual(vscodeUtil.convertToNumber("aaz"), 727);
      assert.deepStrictEqual(vscodeUtil.convertToNumber("aba"), 728);
    });
  });

  describe("objToString", function () {
    it("test", function () {
      assert.deepStrictEqual(vscodeUtil.objToString([0, 1, 2], ", "), "0: 0, 1: 1, 2: 2");
      assert.deepStrictEqual(vscodeUtil.objToString({ a: 1, b: 2 }), "a: 1\nb: 2");
      assert.deepStrictEqual(
        vscodeUtil.objToString({ a: 1, b: [0, 1], c: "c", d: { d1: 1, d2: "2" } }),
        "a: 1\nb: 0: 0, 1: 1\nc: c\nd: d1: 1, d2: 2"
      );
    });
  });

  describe("deleteLine", function () {
    it("test", function () {
      const result = vscodeUtil.deleteLine(FILE4, 1);
      const expected = FILE4.replace(/02.+?\n/, "");
      assert.deepStrictEqual(result, expected);
    });
  });
  describe("insertLine", function () {
    it("test", function () {
      const result = vscodeUtil.insertLine(FILE4, 1, "cat");
      const expected = FILE4.replace(/(02.+?\n)/, "cat\n$1");
      assert.deepStrictEqual(result, expected);
    });
  });
  describe("replaceLine", function () {
    it("test", function () {
      const result = vscodeUtil.replaceLine(FILE4, 1, "cat");
      const expected = FILE4.replace(/(02.+?\n)/, "cat\n");
      assert.deepStrictEqual(result, expected);
    });
  });
  describe("isValidMargin", function () {
    it("test", function () {
      assert.ok(vscodeUtil.isValidMargin("0px 10px -1px +1px"));
      assert.ok(vscodeUtil.isValidMargin("0rem 0em 0ex 0cap"));
      assert.ok(vscodeUtil.isValidMargin("0ch 0ic 0lh 0rlh"));
      assert.ok(vscodeUtil.isValidMargin("0vw 0vh 0vi 0vb"));
      assert.ok(vscodeUtil.isValidMargin("0vmin 0vmax 0% 0%"));
      assert.ok(vscodeUtil.isValidMargin("0vmin 0vmax 0% 0%"));
      assert.ok(vscodeUtil.isValidMargin("0cm 0mm 0Q 0in"));
      assert.ok(vscodeUtil.isValidMargin("0pc 0pt 0px 0%"));
    });
  });
});

describe("VscodeUtil Test Suite 2", function () {
  let document = null;
  let editor = null;
  before(async function () {
    ({ document, editor } = await prepare(FILE_NAME0));
  });

  describe("uriToString", function () {
    it("test", function () {
      const fileFsPath = path.join(ROOT_URI.fsPath, FILE_NAME0);
      const filePath = ROOT_URI.path + `/${FILE_NAME0}`;

      const result = vscodeUtil.uriToString(document.uri);
      assert.strictEqual(
        result,
        `authority: \nfragment: \nfsPath: ${fileFsPath}\npath: ${filePath}\nquery: \nscheme: file`
      );
    });
  });

  describe("getTextDocument", function () {
    it("test", async function () {
      const document1 = await vscode.workspace.openTextDocument(path.join(ROOT_URI.fsPath, FILE_NAME1));
      const document2 = await vscode.workspace.openTextDocument(path.join(ROOT_URI.fsPath, FILE_NAME2));
      const document3 = await vscode.workspace.openTextDocument(path.join(ROOT_URI.fsPath, FILE_NAME3));
      let result = vscodeUtil.getTextDocument(document1.uri);
      assert.strictEqual(result, document1);
      result = vscodeUtil.getTextDocument(document2.uri);
      assert.strictEqual(result, document2);
      result = vscodeUtil.getTextDocument(document3.uri);
      assert.strictEqual(result, document3);
    });
  });

  describe("revealCursor", function () {
    it("test", async function () {
      editor = await vscode.window.showTextDocument(document);
      editor.selection = new vscode.Selection(80, 0, 80, 0);
      await vscodeUtil.revealCursor(editor);
      assert.strictEqual(editor.visibleRanges[0].start.line, 55);
      assert.strictEqual(editor.visibleRanges[0].end.line, 81);
      editor.selection = new vscode.Selection(20, 0, 20, 0);
      await vscodeUtil.revealCursor(editor);
      assert.strictEqual(editor.visibleRanges[0].start.line, 20);
      assert.strictEqual(editor.visibleRanges[0].end.line, 46);
    });
  });

  describe("registerCommand", function () {
    it("test", async function () {
      const context = { subscriptions: [] };
      // @ts-ignore
      vscodeUtil.registerCommand(context, "command1", () => {});
      // @ts-ignore
      vscodeUtil.registerCommand(context, "command2", () => {});
      const commands = await vscode.commands.getCommands();
      assert.strictEqual(context.subscriptions.length, 2);
      assert.strictEqual(commands.includes("command1"), true);
      assert.strictEqual(commands.includes("command2"), true);
      assert.strictEqual(commands.includes("command3"), false);
    });
  });

  describe("getSelection", function () {
    it("no selection", async function () {
      editor = await vscode.window.showTextDocument(document);
      let active = new vscode.Position(0, 0);
      let anchor = new vscode.Position(0, 0);
      editor.selection = new vscode.Selection(anchor, active);
      let position = new vscode.Position(10, 10);
      let expected = new vscode.Selection(position, position);
      let selection = vscodeUtil.getSelection(editor, 0, position);
      assert.deepStrictEqual(selection, expected);

      active = new vscode.Position(10, 10);
      anchor = new vscode.Position(10, 10);
      editor.selection = new vscode.Selection(anchor, active);
      position = new vscode.Position(0, 0);
      expected = new vscode.Selection(position, position);
      selection = vscodeUtil.getSelection(editor, 0, position);
      assert.deepStrictEqual(selection, expected);
    });

    it("selection active", async function () {
      editor = await vscode.window.showTextDocument(document);
      let active = new vscode.Position(5, 0);
      let anchor = new vscode.Position(10, 0);
      editor.selection = new vscode.Selection(anchor, active);
      let position = new vscode.Position(0, 0);
      let expected = new vscode.Selection(active, active);
      let selection = vscodeUtil.getSelection(editor, 0, position);
      assert.deepStrictEqual(selection, expected);

      active = new vscode.Position(10, 0);
      anchor = new vscode.Position(5, 0);
      editor.selection = new vscode.Selection(anchor, active);
      position = new vscode.Position(15, 0);
      expected = new vscode.Selection(active, active);
      selection = vscodeUtil.getSelection(editor, 0, position);
      assert.deepStrictEqual(selection, expected);
    });

    it("selection anchor", async function () {
      editor = await vscode.window.showTextDocument(document);
      let active = new vscode.Position(5, 0);
      let anchor = new vscode.Position(10, 0);
      editor.selection = new vscode.Selection(anchor, active);
      let position = new vscode.Position(15, 0);
      let expected = new vscode.Selection(anchor, anchor);
      let selection = vscodeUtil.getSelection(editor, 0, position);
      assert.deepStrictEqual(selection, expected);

      active = new vscode.Position(10, 0);
      anchor = new vscode.Position(5, 0);
      editor.selection = new vscode.Selection(anchor, active);
      position = new vscode.Position(0, 0);
      expected = new vscode.Selection(anchor, anchor);
      selection = vscodeUtil.getSelection(editor, 0, position);
      assert.deepStrictEqual(selection, expected);
    });
  });

  describe("moveCursors", function () {
    beforeEach(async function () {
      ({ document, editor } = await prepare(FILE_NAME0));
    });

    it("no selection", async function () {
      editor.selections = [new vscode.Selection(0, 0, 0, 0)];
      let positions = [new vscode.Position(10, 10)];
      let expected = [new vscode.Selection(10, 10, 10, 10)];
      vscodeUtil.moveCursors(editor, positions);
      assert.deepStrictEqual(editor.selections, expected);

      editor.selections = [new vscode.Selection(10, 10, 10, 10)];
      positions = [new vscode.Position(0, 0)];
      expected = [new vscode.Selection(0, 0, 0, 0)];
      vscodeUtil.moveCursors(editor, positions);
      assert.deepStrictEqual(editor.selections, expected);
    });
    it("no selections", function () {
      editor.selections = [new vscode.Selection(0, 0, 0, 0), new vscode.Selection(2, 2, 2, 2)];
      const positions = [new vscode.Position(2, 2), new vscode.Position(0, 0)];
      const expected = [new vscode.Selection(2, 2, 2, 2), new vscode.Selection(0, 0, 0, 0)];
      vscodeUtil.moveCursors(editor, positions);
      assert.deepStrictEqual(editor.selections, expected);
    });

    it("selection contract. move to active.", async function () {
      editor.selections = [new vscode.Selection(10, 0, 5, 0)];
      let positions = [new vscode.Position(0, 0)];
      let expected = [new vscode.Selection(5, 0, 5, 0)];
      vscodeUtil.moveCursors(editor, positions);
      assert.deepStrictEqual(editor.selections, expected);

      editor.selections = [new vscode.Selection(5, 0, 10, 0)];
      positions = [new vscode.Position(15, 15)];
      expected = [new vscode.Selection(10, 0, 10, 0)];
      vscodeUtil.moveCursors(editor, positions);
      assert.deepStrictEqual(editor.selections, expected);
    });

    it("selection contract. move to anchor.", async function () {
      editor.selections = [new vscode.Selection(10, 0, 5, 0)];
      let positions = [new vscode.Position(15, 15)];
      let expected = [new vscode.Selection(10, 0, 10, 0)];
      vscodeUtil.moveCursors(editor, positions);
      assert.deepStrictEqual(editor.selections, expected);

      editor.selections = [new vscode.Selection(5, 0, 10, 0)];
      positions = [new vscode.Position(0, 0)];
      expected = [new vscode.Selection(5, 0, 5, 0)];
      vscodeUtil.moveCursors(editor, positions);
      assert.deepStrictEqual(editor.selections, expected);
    });

    it("selections contract.", function () {
      editor.selections = [
        new vscode.Selection(10, 0, 5, 0),
        new vscode.Selection(5, 0, 10, 0),
        new vscode.Selection(10, 0, 5, 0),
        new vscode.Selection(5, 0, 10, 0),
      ];
      let positions = [
        new vscode.Position(0, 0),
        new vscode.Position(15, 15),
        new vscode.Position(15, 15),
        new vscode.Position(0, 0),
      ];
      let expected = [
        new vscode.Selection(5, 0, 5, 0),
        new vscode.Selection(10, 0, 10, 0),
        new vscode.Selection(10, 0, 10, 0),
        new vscode.Selection(5, 0, 5, 0),
      ];
      vscodeUtil.moveCursors(editor, positions);
      assert.deepStrictEqual(editor.selections, expected);
    });
  });

  describe("moveSelections", function () {
    beforeEach(async function () {
      ({ document, editor } = await prepare(FILE_NAME0));
    });

    it("no selection", async function () {
      editor.selections = [new vscode.Selection(5, 5, 5, 5)];
      let positions = [new vscode.Position(10, 10)];
      let expected = [new vscode.Selection(5, 5, 10, 10)];
      vscodeUtil.moveSelections(editor, positions);
      assert.deepStrictEqual(editor.selections, expected);

      editor.selections = [new vscode.Selection(10, 10, 10, 10)];
      positions = [new vscode.Position(5, 5)];
      expected = [new vscode.Selection(10, 10, 5, 5)];
      vscodeUtil.moveSelections(editor, positions);
      assert.deepStrictEqual(editor.selections, expected);
    });

    it("selection expand", async function () {
      editor.selections = [new vscode.Selection(10, 0, 5, 0)];
      let positions = [new vscode.Position(0, 0)];
      let expected = [new vscode.Selection(10, 0, 0, 0)];
      vscodeUtil.moveSelections(editor, positions);
      assert.deepStrictEqual(editor.selections, expected);

      editor.selections = [new vscode.Selection(5, 0, 10, 0)];
      positions = [new vscode.Position(15, 0)];
      expected = [new vscode.Selection(5, 0, 15, 0)];
      vscodeUtil.moveSelections(editor, positions);
      assert.deepStrictEqual(editor.selections, expected);
    });
    it("selection contract.", function () {
      editor.selections = [new vscode.Selection(10, 0, 5, 0)];
      let positions = [new vscode.Position(8, 0)];
      let expected = [new vscode.Selection(10, 0, 8, 0)];
      vscodeUtil.moveSelections(editor, positions);
      assert.deepStrictEqual(editor.selections, expected);

      editor.selections = [new vscode.Selection(5, 0, 10, 0)];
      positions = [new vscode.Position(8, 0)];
      expected = [new vscode.Selection(5, 0, 8, 0)];
      vscodeUtil.moveSelections(editor, positions);
      assert.deepStrictEqual(editor.selections, expected);
    });

    it("selection expand reverse.", function () {
      editor.selections = [new vscode.Selection(10, 0, 5, 0)];
      let positions = [new vscode.Position(15, 0)];
      let expected = [new vscode.Selection(10, 0, 15, 0)];
      vscodeUtil.moveSelections(editor, positions);
      assert.deepStrictEqual(editor.selections, expected);

      editor.selections = [new vscode.Selection(5, 0, 10, 0)];
      positions = [new vscode.Position(0, 0)];
      expected = [new vscode.Selection(5, 0, 0, 0)];
      vscodeUtil.moveSelections(editor, positions);
      assert.deepStrictEqual(editor.selections, expected);
    });

    it("selections", function () {
      editor.selections = [
        new vscode.Selection(5, 5, 5, 5),
        new vscode.Selection(10, 10, 10, 10),
        new vscode.Selection(10, 0, 5, 0),
        new vscode.Selection(5, 0, 10, 0),
        new vscode.Selection(10, 0, 5, 0),
        new vscode.Selection(5, 0, 10, 0),
        new vscode.Selection(10, 0, 5, 0),
        new vscode.Selection(5, 0, 10, 0),
      ];
      const positions = [
        new vscode.Position(10, 10),
        new vscode.Position(5, 5),
        new vscode.Position(0, 0),
        new vscode.Position(15, 0),
        new vscode.Position(8, 0),
        new vscode.Position(8, 0),
        new vscode.Position(15, 0),
        new vscode.Position(0, 0),
      ];
      const expected = [
        new vscode.Selection(5, 5, 10, 10),
        new vscode.Selection(10, 10, 5, 5),
        new vscode.Selection(10, 0, 0, 0),
        new vscode.Selection(5, 0, 15, 0),
        new vscode.Selection(10, 0, 8, 0),
        new vscode.Selection(5, 0, 8, 0),
        new vscode.Selection(10, 0, 15, 0),
        new vscode.Selection(5, 0, 0, 0),
      ];
      vscodeUtil.moveSelections(editor, positions);
      assert.deepStrictEqual(editor.selections, expected);
    });
  });

  describe("deleteLine", function () {
    beforeEach(async function () {
      ({ document, editor } = await prepare(FILE_NAME4));
    });
    it("test", async function () {
      let expected = FILE4;
      assert.strictEqual(document.lineCount, 5);
      assert.deepStrictEqual(document.getText(), expected);
      await vscodeUtil.vsDeleteLine(document, 1);
      expected = vscodeUtil.deleteLine(FILE4, 1);
      assert.strictEqual(document.lineCount, 4);
      assert.deepStrictEqual(document.getText(), expected);
      await vscode.commands.executeCommand("undo");
    });
  });

  describe("insertLine", function () {
    beforeEach(async function () {
      ({ document, editor } = await prepare(FILE_NAME4));
    });
    it("test", async function () {
      let expected = FILE4;
      assert.strictEqual(document.lineCount, 5);
      assert.deepStrictEqual(document.getText(), expected);
      await vscodeUtil.vsInsertLine(document, 1, "cat");
      expected = vscodeUtil.insertLine(FILE4, 1, "cat");
      assert.strictEqual(document.lineCount, 6);
      assert.deepStrictEqual(document.getText(), expected);
      await vscode.commands.executeCommand("undo");
    });
  });

  describe("replaceLine", function () {
    beforeEach(async function () {
      ({ document, editor } = await prepare(FILE_NAME4));
    });
    it("test", async function () {
      let expected = FILE4;
      assert.strictEqual(document.lineCount, 5);
      assert.deepStrictEqual(document.getText(), expected);
      await vscodeUtil.vsReplaceLine(document, 1, "cat");
      expected = vscodeUtil.replaceLine(FILE4, 1, "cat");
      assert.strictEqual(document.lineCount, 5);
      assert.deepStrictEqual(document.getText(), expected);
      await vscode.commands.executeCommand("undo");
    });
  });
});
