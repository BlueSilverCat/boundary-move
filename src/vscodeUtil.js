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

function deleteLine(text, lineIndex, eol = "\n") {
  const array = text.split(eol);
  if (lineIndex < 0 || lineIndex > array.length - 1) {
    return text;
  }
  array.splice(lineIndex, 1);
  return array.join(eol);
}

function insertLine(text, lineIndex, string, eol = "\n") {
  const array = text.split(eol);
  if (lineIndex < 0 || lineIndex > array.length - 1) {
    return text;
  }
  array.splice(lineIndex, 0, "");
  array[lineIndex] = string;
  return array.join(eol);
}

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
function moveCursors(editor, positions) {
  let selections = [];
  for (let i = 0; i < positions.length; ++i) {
    selections.push(getSelection(editor, i, positions[i]));
  }
  editor.selections = selections;
  revealCursor(editor);
}

/**
 * @param { import("vscode").TextEditor } editor
 * @param {{ line:number, character:number }[]} positions
 */
function moveSelections(editor, positions) {
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
  revealCursor(editor);
}

/**
 * @param { import("vscode").TextEditor } editor
 */
async function revealCursor(editor) {
  //need fix
  const line = editor.selection.active.line;
  // const character = editor.selection.active.character;
  for (let i = 0; i < 1; ++i) {
    if (line > editor.visibleRanges[i].start.line && line < editor.visibleRanges[i].end.line) {
      await vscode.commands.executeCommand("cursorMove", { to: "viewPortIfOutside" });
      continue;
    }

    let diff = 0;
    diff = editor.visibleRanges[i].start.line - line;
    if (diff > 0 && editor.visibleRanges[i].start.line > 0) {
      await vscode.commands.executeCommand("revealLine", { lineNumber: line, at: "top" });
      continue;
    }
    diff = line - editor.visibleRanges[i].end.line + 1;
    if (diff > 0 && editor.visibleRanges[i].end.line < editor.document.lineCount - 1) {
      await vscode.commands.executeCommand("revealLine", { lineNumber: line, at: "bottom" });
    }
  }
}

// vissibleRangesが複数の場合は、どんな時?
// editor.vissibleRanges.lengthが取れないのはなぜ?
// editor.vissibleRanges readonly
// editor.revealRange()は、タイムラグがある割がawaitが使えないので使い勝手が悪い
// async function revealCursor(editor, type = 0) {
//   //need fix
//   const line = editor.selection.active.line;
//   // const character = editor.selection.active.character;
//   for (let i = 0; i < 1; ++i) {
//     if (line > editor.visibleRanges[i].start.line && line < editor.visibleRanges[i].end.line) {
//       await vscode.commands.executeCommand("cursorMove", { to: "viewPortIfOutside" });
//       continue;
//     }

//     let diff = 0;
//     diff = editor.visibleRanges[i].start.line - line + 1;
//     if (diff > 0) {
//       editor.revealRange(
//         new vscode.Range(
//           subLimit(editor.visibleRanges[i].start.line, diff),
//           0,
//           subLimit(editor.visibleRanges[i].end.line, diff),
//           0
//         ),
//         type
//       );
//       continue;
//     }
//     diff = line - editor.visibleRanges[i].end.line + 1;
//     if (diff > 0) {
//       editor.revealRange(
//         new vscode.Range(
//           addLimit(editor.visibleRanges[i].start.line, diff, editor.document.lineCount),
//           0,
//           addLimit(editor.visibleRanges[i].end.line, diff, editor.document.lineCount),
//           0
//         ),
//         type
//       );
//     }
//   }
// }

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

  let eol = "\n";
  if (document.eol === vscode.EndOfLine.CRLF) {
    eol = "\r\n";
  }
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
  let eol = "\n";
  if (document.eol === vscode.EndOfLine.CRLF) {
    eol = "\r\n";
  }
  //const length = document.lineAt(lineIndex).text.length;
  const workspaceEdit = new vscode.WorkspaceEdit();
  workspaceEdit.replace(document.uri, new vscode.Range(lineIndex, 0, lineIndex + 1, 0), string + eol);
  await vscode.workspace.applyEdit(workspaceEdit);
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

// function getTextDocumentChangeEventInfo(event, separator = "\n") {
//   let result = "";
//   for (const contentChange of event.contentChanges) {
//     result += `range: \n${getRangeInfo(contentChange.range)}${separator}`;
//     result += `rangeLength: ${contentChange.rangeLength}${separator}`;
//     result += `rangeOffset: ${contentChange.rangeOffset}${separator}`;
//     result += `psitionAt: ${getPositionInfo(event.document.positionAt(contentChange.rangeOffset), ", ")}${separator}`;
//     result += `psitionAt: ${getPositionInfo(
//       event.document.positionAt(contentChange.rangeOffset + contentChange.rangeLength),
//       ", "
//     )}${separator}`;
//     result += `text: ${contentChange.text}${separator}`;
//   }
//   const re = new RegExp(`${separator}$`);
//   result = result.replace(re, "");
//   return result;
// }

// function getRangeInfo(range, separator = "\n") {
//   let result = "";
//   result += `start: ${getPositionInfo(range.start, ", ")}${separator}`;
//   result += `end: ${getPositionInfo(range.end, ", ")}${separator}`;
//   result += `isEmpty: ${range.isEmpty}${separator}`;
//   result += `isSingleLine: ${range.isSingleLine}`;
//   return result;
// }

// function getPositionInfo(position, separator = "\n") {
//   let result = "";
//   result += `line: ${position.line}${separator}`;
//   result += `character: ${position.character}`;
//   return result;
// }

////////////////////////////////////////////////////////////////////////////////
// exports
////////////////////////////////////////////////////////////////////////////////

exports.isEmpty = isEmpty;
exports.subLimit = subLimit;
exports.addLimit = addLimit;
exports.isSameObj = isSameObj;
exports.sortKey = sortKey;
exports.uniquePush = uniquePush;
exports.convertToString = convertToString;
exports.convertToNumber = convertToNumber;
exports.deleteLine = deleteLine;
exports.insertLine = insertLine;
exports.replaceLine = replaceLine;
exports.isValidMargin = isValidMargin;
exports.objToString = objToString;

exports.revealCursor = revealCursor;
exports.registerCommand = registerCommand;
exports.getTextDocument = getTextDocument;
exports.uriToString = uriToString;
exports.getSelection = getSelection;

exports.moveCursors = moveCursors;
exports.moveSelections = moveSelections;

exports.vsDeleteLine = vsDeleteLine;
exports.vsInsertLine = vsInsertLine;
exports.vsReplaceLine = vsReplaceLine;
// exports.getTextLines = getTextLines;
// exports.outputToChannel = outputToChannel;
// exports.getLastActiveEditor = getLastActiveEditor;
// exports.getEditorInfo = getEditorInfo;
// exports.getRangeInfo = getRangeInfo;
// exports.getTextDocumentChangeEventInfo = getTextDocumentChangeEventInfo;
