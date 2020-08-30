const vscode = require("vscode");

////////////////////////////////////////////////////////////////////////////////
// utility
////////////////////////////////////////////////////////////////////////////////

/**
 * @param {*} obj
 * @returns {boolean}
 */
function isEmpty(obj) {
  if (obj === null || typeof obj === "undefined" || obj === "") {
    return true;
  } else if (typeof obj === "object" && Object.keys(obj).length === 0) {
    // Object.getOwnPropertyNames(obj)
    return true;
  }
  return false;
}

/**
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function subLimit(a, b, limit = 0) {
  if (a - b < limit) {
    return limit;
  }
  return a - b;
}

/**
 * @param {number} a
 * @param {number} b
 * @return {number}
 */
function addLimit(a, b, limit = 0) {
  if (a + b > limit) {
    return limit;
  }
  return a + b;
}

/**
 * @param {any} obj1
 * @param {any} obj2
 * @returns {boolean}
 */
function isSameObj(obj1, obj2) {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

/**
 * @param {object} obj
 * @returns {object}
 */
function sortKey(obj) {
  const result = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      result[key] = obj[key];
    });
  return result;
}

/**
 * @param {array} array
 * @param {*} data
 * @return {array}
 */
function uniquePush(array, data) {
  if (array.includes(data) === false) {
    // if (array.indexOf(data) === -1) {
    array.push(data);
  }
  return array;
}

/**
 * @param {array} array
 * @param {*} data
 * @return {array}
 */
function pushNoEmpty(array, data) {
  if (isEmpty(data) === false) {
    array.push(data);
  }
  return array;
}

/**
 * @param {object} obj
 * @param {string} eol
 * @returns {string}
 * JSON.stringify(obj) にしても良いかも
 */
function objToString(obj, eol = "\n") {
  const re = new RegExp(`${eol}$`);
  let result = "";
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "object") {
      result += `${key}: ${objToString(obj[key], ", ")}${eol}`;
    } else {
      result += `${key}: ${obj[key]}${eol}`;
    }
  }
  return result.replace(re, "");
}

/**
 * @param {number} n
 * @param {string} char
 * @param {number} radix
 * @returns {string}
 */
// a = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"
// "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z
function convertToString(n, char = "a", radix = 26) {
  const code = char.codePointAt(0);
  let result = String.fromCodePoint(code + (n % radix));
  let rest = Math.floor(n / radix);
  while (rest > 0) {
    rest -= 1;
    result = String.fromCodePoint((rest % radix) + code) + result;
    rest = Math.floor(rest / radix);
  }
  return result;
}

/**
 * @param {string} str
 * @param {string} char
 * @param {number} radix
 * @returns {number}
 */
function convertToNumber(str, char = "a", radix = 26) {
  const code = char.codePointAt(0);
  let result = str.codePointAt(str.length - 1) - code;
  let rest = str.slice(0, -1);
  let r = radix;
  while (rest.length > 0) {
    result += (rest.codePointAt(rest.length - 1) - code + 1) * r;
    rest = rest.slice(0, -1);
    r *= radix;
  }
  return result;
}

class RadixConverter {
  constructor(char = "a", radix = 26) {
    this.char = char;
    this.radix = radix;
    this.ntsTable = {};
    this.stnTable = {};
  }

  /**
   * @param {number} n
   * @returns {string}
   */
  convertToString(n) {
    if (this.ntsTable.hasOwnProperty(n) === true) {
      return this.ntsTable[n];
    }
    const result = convertToString(n, this.char, this.radix);
    this.ntsTable[n] = result;
    return result;
  }

  /**
   * @param {string} str
   * @returns {number}
   */
  convertToNumber(str) {
    if (this.stnTable.hasOwnProperty(str) === true) {
      return this.stnTable[str];
    }
    const result = convertToNumber(str, this.char, this.radix);
    this.stnTable[str] = result;
    return result;
  }
}

/**
 *
 * @param {string} text
 * @param {number} lineIndex
 * @param {string} eol
 * @return {string}
 */
function deleteLine(text, lineIndex, eol = "\n") {
  const array = text.split(eol);
  if (lineIndex < 0 || lineIndex > array.length - 1) {
    return text;
  }
  array.splice(lineIndex, 1);
  return array.join(eol);
}

/**
 *
 * @param {string} text
 * @param {number} lineIndex
 * @param {string} eol
 * @return {string}
 */
function insertLine(text, lineIndex, string, eol = "\n") {
  const array = text.split(eol);
  if (lineIndex < 0 || lineIndex > array.length - 1) {
    return text;
  }
  array.splice(lineIndex, 0, "");
  array[lineIndex] = string;
  return array.join(eol);
}

/**
 *
 * @param {string} text
 * @param {number} lineIndex
 * @param {string} string
 * @param {string} eol
 * @return {string}
 */
function replaceLine(text, lineIndex, string, eol = "\n") {
  const array = text.split(eol);
  if (lineIndex < 0 || lineIndex > array.length - 1) {
    return text;
  }
  array[lineIndex] = string;
  return array.join(eol);
}

/**
 * @param {string} margin
 * @return {boolean}
 */
function isValidMargin(margin) {
  const re = / *[+\-]?\d+(?:%|r?(?:em|lh)|ex|cap|ch|ic|v(?:w|h|i|b|m(in|ax))|[cm]m|Q|in|p[ctx])(?: +[+\-]?\d+(?:%|r?(?:em|lh)|ex|cap|ch|ic|v(?:w|h|i|b|m(in|ax))|[cm]m|Q|in|p[ctx])){3}/;
  return re.test(margin);
}

/**
 * text内のstringの出現回数を返す。
 * @param {string} text
 * @param {string} string
 */
function countString(text, string) {
  const re = new RegExp(string, "g");
  const result = text.match(re);
  if (result === null) {
    return 0;
  }
  return result.length;
}

/**
 * array の start から end までを data で置き換えた配列を返す
 * @param{any[]} array
 * @param{number} start
 * @param{number} end
 * @param{any[]} data
 * @param{boolean} insert
 */
function arrayReplace(array, start, end, data, insert = false) {
  const head = array.slice(0, start);
  let tailIndex = end;
  if (insert === false) {
    tailIndex++;
  }
  const tail = array.slice(tailIndex);
  return head.concat(data.concat(tail));
}

/*
 * array を pop する。ただし、空の場合は、valueを返す
 * @param{any[]} array
 * @param{any} value
 */
function limitPop(array, value = []) {
  if (array.length === 0) {
    return value;
  }
  return array.pop();
}

/*
 * array を shift する。ただし、空の場合は、valueを返す
 * @param{any[]} array
 * @param{any} value
 */
function limitShift(array, value = []) {
  if (array.length === 0) {
    return value;
  }
  return array.shift();
}

/**
 * array の startRow, startColumn から endRow, endRow までを data で置き換えた配列を返す
 * @param{any[]} array
 * @param{number} startRow
 * @param{number} startColumn
 * @param{number} endRow
 * @param{number} endColumn
 * @param{any[]} data
 * @param{boolean} insert
 */
function arrayReplace2d(array, startRow, startColumn, endRow, endColumn, data, insert = false) {
  const result = [];
  data.reverse();
  let start = 0;
  let end = 0;
  for (let row = startRow; row <= endRow; ++row) {
    if (row === startRow) {
      start = startColumn;
      if (startRow === endRow) {
        end = endColumn;
      } else {
        if (insert === true) {
          end = array[row].length;
        } else {
          end = array[row].length - 1;
        }
      }
    } else if (row === endRow) {
      start = 0;
      end = endColumn;
    } else {
      start = 0;
      if (insert === true) {
        end = array[row].length;
      } else {
        end = array[row].length - 1;
      }
    }
    pushNoEmpty(result, arrayReplace(array[row], start, end, limitPop(data), insert));
  }
  return arrayReplace(array, startRow, endRow, result);
}

/**
 *
 * @param {string} string
 * @param {string} separator
 * @return {string[]}
 */
function splitIncludeSeparator(string, separator = "\n") {
  const result = [];
  let work = string;
  let index = string.indexOf(separator);
  let current = 0;
  while (index !== -1) {
    result.push(work.slice(current, index + separator.length));
    work = work.slice(index + separator.length);
    current = index + separator.length;
    index = work.indexOf(separator);
  }
  result.push(work);
  return result;
}

/**
 *
 * @param {any[][]} array
 * @param {number} startRow
 * @param {number} startColumn
 * @param {number} endRow
 * @param {number} endColumn
 * @return {any[][]}
 */
function slice2d(array, startRow, startColumn, endRow = null, endColumn = null) {
  const result = [];
  let start = 0;
  let end = 0;
  let endR = endRow !== null ? endRow : array.length - 1;
  endR = endR > array.length - 1 ? array.length - 1 : endR;
  for (let row = startRow; row <= endR; ++row) {
    if (row === startRow) {
      start = startColumn;
      end = array[row].length;
      if (startRow === endR) {
        end = endColumn !== null ? endColumn : array[row].length;
      }
    } else if (row === endR) {
      start = 0;
      end = endColumn !== null ? endColumn : array[row].length;
    } else {
      start = 0;
      end = array[row].length;
    }
    if (start !== end) {
      result.push(array[row].slice(start, end));
    }
  }
  return result;
}

////////////////////////////////////////////////////////////////////////////////
// vscode
////////////////////////////////////////////////////////////////////////////////

/**
 * @param { import("vscode").TextEditor } editor
 * @param {number} index
 * @param {{ line:number, character:number }} position
 * anchor active pos
 * pos anchor active
 * anchor pos active
 * active anchor pos
 * pos active anchor
 * active pos anchor
 */
function getSelection(editor, index, position) {
  const active = editor.selections[index].active;
  const anchor = editor.selections[index].anchor;
  const pos = new vscode.Position(position.line, position.character);
  if (active.isEqual(anchor) === true) {
    return new vscode.Selection(pos, pos);
  }

  if (
    (active.isAfter(anchor) === true && active.isBefore(pos)) ||
    (active.isBefore(anchor) === true && active.isAfter(pos))
  ) {
    return new vscode.Selection(active, active);
  } else {
    // else if(active.isAfter(anchor) === true && active.isAfter(pos)) || (active.isBefore(anchor) === true && active.isBefore(pos))
    return new vscode.Selection(anchor, anchor);
  }
}

/**
 * @param { import("vscode").TextEditor } editor
 * @param {{ line:number, character:number }[]} positions
 */
async function moveCursors(editor, positions) {
  let selections = [];
  for (let i = 0; i < positions.length; ++i) {
    selections.push(getSelection(editor, i, positions[i]));
  }
  editor.selections = selections;
  await revealLine(editor);
  await revealCursor(editor);
}

/**
 * @param { import("vscode").TextEditor } editor
 * @param {{ line:number, character:number }[]} positions
 */
async function moveSelections(editor, positions) {
  let line = 0;
  let character = 0;
  let active = null;
  let anchor = null;
  const selections = [];
  for (let i = 0; i < positions.length; ++i) {
    anchor = editor.selections[i].anchor;
    ({ line, character } = positions[i]);
    active = new vscode.Position(line, character);
    selections.push(new vscode.Selection(anchor, active));
  }
  editor.selections = selections;
  await revealLine(editor);
  await revealCursor(editor); // need fix これによって選択範囲が途切れる事がある
  editor.selections = selections; // 応急処置
}

/**
 * @param { import("vscode").TextEditor } editor
 */
async function revealLine(editor, center = false) {
  let atUp = "top";
  let atDown = "bottom";
  if (center === true) {
    atUp = "center";
    atDown = "center";
  }

  const line = editor.selection.active.line;
  for (let i = 0; i < 1; ++i) {
    if (line < editor.visibleRanges[i].start.line && editor.visibleRanges[i].start.line > 0) {
      await vscode.commands.executeCommand("revealLine", { lineNumber: line, at: atUp });
    } else if (
      line > editor.visibleRanges[i].end.line &&
      editor.visibleRanges[i].end.line < editor.document.lineCount
    ) {
      await vscode.commands.executeCommand("revealLine", { lineNumber: line, at: atDown });
    }
  }
}

/**
 * need fix
 * @param {*} editor
 * selectionが切れてしまうのはこいつが原因
 */
async function revealCursor(editor) {
  const line = editor.selection.active.line;
  if (line < editor.visibleRanges[0].end.line) {
    await vscode.commands.executeCommand("cursorMove", { to: "viewPortIfOutside" }); //実際に見えている範囲より-1された範囲がvisibleRangeとして認識される
  }
}

async function cursorToCenter(editor) {
  await vscode.commands.executeCommand("revealLine", { lineNumber: editor.selection.active.line, at: "center" });
}

/**
 * @param {vscode.ExtensionContext} context
 * @param {string} command
 * @param {commandCallback} callback
 * @callback commandCallback
 */
function registerCommand(context, command, callback) {
  context.subscriptions.push(vscode.commands.registerCommand(command, callback));
}

/**
 * @param {vscode.Uri} uri
 * @returns {vscode.TextDocument}
 */
function getTextDocument(uri) {
  let documents = vscode.workspace.textDocuments;
  documents = documents.filter((e) => {
    return e.uri.path === uri.path;
  });
  if (documents.length === 0) {
    return null;
  }
  return documents[0];
}

/**
 * @param {import("vscode").Uri} uri
 * @return {string}
 */
function uriToString(uri, sep = "\n") {
  let result = "";
  result += `authority: ${uri.authority}${sep}`;
  result += `fragment: ${uri.fragment}${sep}`;
  result += `fsPath: ${uri.fsPath}${sep}`;
  result += `path: ${uri.path}${sep}`;
  result += `query: ${uri.query}${sep}`;
  result += `scheme: ${uri.scheme}`;
  return result;
}

/**
 * @param {vscode.TextDocument} document
 * @param {number} lineIndex
 */
async function vsDeleteLine(document, lineIndex) {
  if (lineIndex < 0 || lineIndex > document.lineCount) {
    return;
  }
  //const length = document.lineAt(lineIndex).text.length;
  const workspaceEdit = new vscode.WorkspaceEdit();
  workspaceEdit.delete(document.uri, new vscode.Range(lineIndex, 0, lineIndex + 1, 0));
  await vscode.workspace.applyEdit(workspaceEdit);
}

/**
 * @param {vscode.TextDocument} document
 * @param {number} lineIndex
 * @param {string} string
 */
async function vsInsertLine(document, lineIndex, string) {
  if (lineIndex < 0 || lineIndex > document.lineCount) {
    return;
  }

  const eol = getEol(document.eol);
  //const length = document.lineAt(lineIndex).text.length;
  const workspaceEdit = new vscode.WorkspaceEdit();
  workspaceEdit.insert(document.uri, new vscode.Position(lineIndex, 0), string + eol);
  await vscode.workspace.applyEdit(workspaceEdit);
}

/**
 * @param {vscode.TextDocument} document
 * @param {number} lineIndex
 * @param {string} string
 */
async function vsReplaceLine(document, lineIndex, string) {
  if (lineIndex < 0 || lineIndex > document.lineCount) {
    return;
  }

  const eol = getEol(document.eol);
  //const length = document.lineAt(lineIndex).text.length;
  const workspaceEdit = new vscode.WorkspaceEdit();
  workspaceEdit.replace(document.uri, new vscode.Range(lineIndex, 0, lineIndex + 1, 0), string + eol);
  await vscode.workspace.applyEdit(workspaceEdit);
}

/**
 *
 * @param {number} level
 */
async function fontZoomOut(level) {
  for (let i = 0; i < level; ++i) {
    await vscode.commands.executeCommand("editor.action.fontZoomOut");
  }
}

/**
 *
 * @param {number} level
 */
async function fontZoomIn(level) {
  for (let i = 0; i < level; ++i) {
    await vscode.commands.executeCommand("editor.action.fontZoomIn");
  }
}

/**
 *
 * @param {number} num vscode.EndOfLine
 */
function getEol(num) {
  let eol = "\n";
  if (num === vscode.EndOfLine.CRLF) {
    eol = "\r\n";
  }
  return eol;
}

////////////////////////////////////////////////////////////////////////////////
// experimental
////////////////////////////////////////////////////////////////////////////////

// /**
//  * @param {import("vscode").TextDocument} document
//  */
// function getTextLines(document) {
//   const lines = [];
//   for (let i = 0; i < document.lineCount; ++i) {
//     lines.push(document.lineAt(i));
//   }
//   return lines;
// }

// /**
//  * @param {import("vscode").OutputChannel} channel
//  * @param {string} message
//  */
// function outputToChannel(channel, message, name = "", cs = false) {
//   //channel.appendLine(`${name}: ${message}`);
//   channel.appendLine(`${message}`);
//   if (cs === true) {
//     console.log(`${name}: ${message}`);
//   }
// }

////////////////////////////////////////////////////////////////////////////////
// debug
////////////////////////////////////////////////////////////////////////////////

// function printMatch(match) {
//   if (match !== null) {
//     console.log(match[0]);
//     console.log(match.index);
//     console.log(match[0].length);
//   }
// }

// /**
//  * @param {import("vscode").TextEditor} editor
//  */
// function getEditorInfo(editor) {
//   if (isEmpty(editor) === true) {
//     return;
//   }
//   let result = "";
//   result += `editor: ${editor}\n`;
//   result += `version: ${editor.document.version}\n`;
//   result += `fileName: ${editor.document.fileName}\n`;
//   result += `uri: ${editor.document.uri}\n`;
//   result += `editor.options: ${editor.options}\n`;
//   result += `text: ${editor.document.getText()}\n`;
//   return result;
// }

// function getLastActiveEditor() {
//   let editor = vscode.window.activeTextEditor;
//   if (typeof editor !== "undefined") {
//     return editor;
//   }
//   const editors = vscode.window.visibleTextEditors;
//   if (editors.length === 0) {
//     return null;
//   }
//   let last = 0;
//   for (let tmp of editors) {
//     if (last <= tmp.document.version) {
//       last = tmp.document.version;
//       editor = tmp;
//     }
//   }
//   return editor;
// }

// /**
//  * @param {vscode.workspace} workspace
//  */
// function getWorkspaceInfo(workspace) {
//   let result = `name: ${workspace.name}\n`;
//   result += `rootPath: ${workspace.rootPath}\n`;
//   result += `file: ${workspace.workspaceFile}\n`;
//   for (const document of workspace.textDocuments) {
//     result += `document.fileName: ${document.fileName}\n`;
//     result += `document.uri: ${document.uri}\n`;
//   }
//   for (const folder of workspace.workspaceFolders) {
//     result += `folder.index: ${folder.index}\n`;
//     result += `folder.name: ${folder.name}\n`;
//     result += `folder.uri: ${folder.uri}\n`;
//   }
//   return result;
// }

function getTextDocumentChangeEventInfo(event, separator = "\n") {
  let result = "";
  for (const contentChange of event.contentChanges) {
    result += `range: \n${getRangeInfo(contentChange.range)}${separator}`;
    result += `rangeLength: ${contentChange.rangeLength}${separator}`;
    result += `rangeOffset: ${contentChange.rangeOffset}${separator}`;
    result += `positionAt: ${getPositionInfo(event.document.positionAt(contentChange.rangeOffset), ", ")}${separator}`;
    result += `positionAt: ${getPositionInfo(
      event.document.positionAt(contentChange.rangeOffset + contentChange.rangeLength),
      ", "
    )}${separator}`;
    result += `text: "${contentChange.text}"${separator}`;
  }
  const re = new RegExp(`${separator}$`);
  result = result.replace(re, "");
  return result;
}

function getRangeInfo(range, separator = "\n") {
  let result = "";
  result += `start: ${getPositionInfo(range.start, ", ")}${separator}`;
  result += `end: ${getPositionInfo(range.end, ", ")}${separator}`;
  result += `isEmpty: ${range.isEmpty}${separator}`;
  result += `isSingleLine: ${range.isSingleLine}`;
  return result;
}

function getPositionInfo(position, separator = "\n", label = true) {
  let result = "";
  let lineLabel = "line: ";
  let characterLabel = "character: ";
  if (label === false) {
    lineLabel = "";
    characterLabel = "";
  }

  result += `${lineLabel}${position.line}${separator}`;
  result += `${characterLabel}${position.character}`;
  return result;
}

function getSelectionsInfo(selections, sep = "\n") {
  let result = "";
  for (const selection of selections) {
    result += `selection.start: ${getPositionInfo(selection.start, ", ", false)} -- `;
    result += `selection.end:  ${getPositionInfo(selection.end, ", ", false)}${sep}`;
    result += `selection.anchor:  ${getPositionInfo(selection.anchor, ", ", false)} -- `;
    result += `selection.active:  ${getPositionInfo(selection.active, ", ", false)}`;
  }
  return result;
}

////////////////////////////////////////////////////////////////////////////////
// exports
////////////////////////////////////////////////////////////////////////////////

exports.isEmpty = isEmpty;
exports.subLimit = subLimit;
exports.addLimit = addLimit;
exports.isSameObj = isSameObj;
exports.sortKey = sortKey;
exports.uniquePush = uniquePush;
exports.pushNoEmpty = pushNoEmpty;
exports.convertToString = convertToString;
exports.convertToNumber = convertToNumber;
exports.RadixConverter = RadixConverter;

exports.deleteLine = deleteLine;
exports.insertLine = insertLine;
exports.replaceLine = replaceLine;
exports.isValidMargin = isValidMargin;
exports.objToString = objToString;
exports.countString = countString;

exports.arrayReplace = arrayReplace;
exports.limitPop = limitPop;
exports.limitShift = limitShift;
exports.slice2d = slice2d;

exports.arrayReplace2d = arrayReplace2d;
exports.splitIncludeSeparator = splitIncludeSeparator;

exports.revealCursor = revealCursor;
exports.cursorToCenter = cursorToCenter;
exports.registerCommand = registerCommand;
exports.getTextDocument = getTextDocument;
exports.uriToString = uriToString;
exports.getSelection = getSelection;

exports.moveCursors = moveCursors;
exports.moveSelections = moveSelections;

exports.vsDeleteLine = vsDeleteLine;
exports.vsInsertLine = vsInsertLine;
exports.vsReplaceLine = vsReplaceLine;

exports.fontZoomOut = fontZoomOut;
exports.fontZoomIn = fontZoomIn;

exports.getEol = getEol;
// exports.getTextLines = getTextLines;
// exports.outputToChannel = outputToChannel;
// exports.getLastActiveEditor = getLastActiveEditor;
// exports.getEditorInfo = getEditorInfo;
// exports.getRangeInfo = getRangeInfo;
exports.getTextDocumentChangeEventInfo = getTextDocumentChangeEventInfo;
exports.getSelectionsInfo = getSelectionsInfo;
