scroll 水平スクロール機能を修正しないと
jump もう少し使い勝手を良くしたい
change symbol rename で変更を正しく検出できなかった時があった

---

```javascript
vscodeUtil.registerCommand(context, "type", (args) => {
  if (isJumpMode === false) {
    vscode.commands.executeCommand("default:type", { text: args.text });
    return;
  }

  isJumpMode = jump(args.text, Input);
});

function jump(character, Input) {
  const reCheck = /[0-9 ]/;
  const reCommand = /(\d+) +(\d+) +/;
  let match = null;
  console.log(character, Input);
  if (reCheck.test(character) === false) {
    vscode.commands.executeCommand("default:type", { text: character });
    Input.splice(0);
    return false;
  } else {
    Input.push(character);
  }

  match = Input.join("").match(reCommand);
  if (match !== null) {
    const editor = vscode.window.activeTextEditor;
    if (typeof editor !== "undefined") {
      bmm.jump(editor, { line: parseInt(match[1], 10), count: parseInt(match[2], 10) });
      Input.splice(0);
      return false;
    }
  }
  //vscode.commands.executeCommand("default:type", { text: args.text });
  return true;
}

let progressOption = {
  cancellable: false,
  location: vscode.ProgressLocation.Notification,
  title: "BoundaryMove: ",
};
context.subscriptions.push(
  vscode.workspace.onDidOpenTextDocument((document) => {
    // eslint-disable-next-line no-unused-vars
    vscode.window.withProgress(progressOption, (progress, _token) => {
      return new Promise((resolve) => {
        progress.report({ increment: 0, message: "scanning..." });
        bmm.add(document);
        progress.report({ increment: 100, message: "finish." });
        resolve();
      });
    });
  })
);
context.subscriptions.push(
  vscode.workspace.onDidCloseTextDocument((document) => {
    bmm.delete(document);
  })
);
progressOption = {
  cancellable: false,
  location: vscode.ProgressLocation.Window,
  title: "BoundaryMove: ",
};
context.subscriptions.push(
  vscode.workspace.onDidChangeTextDocument((event) => {
    // eslint-disable-next-line no-unused-vars
    vscode.window.withProgress(progressOption, (progress, _token) => {
      return new Promise((resolve) => {
        progress.report({ increment: 0, message: "scanning..." });
        bmm.change(event);
        progress.report({ increment: 100, message: "finish." });
        resolve();
      });
    });
  })
);

文字を表示するために位置がずれていく;
for (const range of rangesBeforeOdd) {
  temp.push({
    range: range,
    renderOptions: {
      before: {
        contentText: "b",
      },
      after: {
        contentText: "a",
      },
    },
  });
}
editor.setDecorations(decorationTypeBeforeOdd, temp);
```

```javascript
function getSvgDataUri(text) {
  const editorConfig = vscode.workspace.getConfiguration("editor");
  //const fontFamily = "Migu 1M"; //editorConfig.get("fontFamily");
  const fontSize = editorConfig.get("fontSize") - 2;
  const width = text.length / 2;
  const height = "0.75em";
  const bgColor = "red";
  const fgColor = "blue";

  // prettier-ignore
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width}em ${height}" width="${width}em" height="${height}">`;
  // prettier-ignore
  svg += `<rect width="100%" height="100%" rx="25%" ry="25%" style="fill: black;"/>`;
  // prettier-ignore
  //svg += `<text font-family="${fontFamily}" font-size="${fontSize}px" textLength="${width - 2}" textAdjust="spacing" fill="${fgColor}" x="1" y="${fontSize - 2}" alignment-baseline="baseline">`;
  svg += `<text font-family="monospace" text-anchor="middle" font-size="75%" fill="white" x="50%" y="75%" textLength="75%">`;
  svg += text;
  svg += `</text>`;
  svg += `</svg>`;

  return vscode.Uri.parse(`data:image/svg+xml;utf8,${svg}`);
}

/**
 * @param {import("vscode").TextEditor} editor
 * @param {{range: import("vscode").Range, textContent: string, index: number}[][]} decoratonRanges
 */
function setDecorations(editor, decoratonRanges) {
  const decorationType = vscode.window.createTextEditorDecorationType({});
  const options = [];
  let length = 0;
  for (const lineDecorationRanges of decoratonRanges) {
    for (const option of lineDecorationRanges) {
      length = (option.range.end.character - option.range.start.character) / 2;
      options.push({
        range: option.range,
        renderOptions: {
          after: {
            //margin: bm.MarkerMargin,
            margin: `0 0 0 -${length}em`, //全角が含まれている場合を考慮しないといけない
            //contentIconPath: getSvgDataUri(option.textContent), //上下位置を調整できないとあまり意味がない
            contentText: option.textContent,
            //height: "50%",
            //width: "0px",
            color: { id: "boundaryMove.markerColor" },
            backgroundColor: { id: "boundaryMove.markerBackgroundColor" },
            border: "solid",
            borderColor: { id: "boundaryMove.markerColor" },
          },
        },
      });
    }
  }
  editor.setDecorations(decorationType, options);
  return decorationType;
}
```
