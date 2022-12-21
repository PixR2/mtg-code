import * as vscode from 'vscode';
import { lineSplitterRegExp, commentLineRegExp } from './regular_expressions';

export class CommentLineFoldingRangeProvider implements vscode.FoldingRangeProvider {
    constructor() { }

    onDidChangeFoldingRanges?: vscode.Event<void> | undefined;
    provideFoldingRanges(document: vscode.TextDocument, context: vscode.FoldingContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FoldingRange[]> {
        const lines: string[] = document.getText().split(lineSplitterRegExp);

        let commentLineNumbers: number[] = [];
        for (const [lineNum, line] of lines.entries()) {
            const isCommentLine = commentLineRegExp.test(line);
            if (!isCommentLine) {
                continue;
            }

            commentLineNumbers.push(lineNum);
        }

        let foldingRanges: vscode.FoldingRange[] = [];
        for (let i = 0; i < commentLineNumbers.length - 1; ++i) {
            const newFoldingRange = new vscode.FoldingRange(
                commentLineNumbers[i],
                commentLineNumbers[i + 1] - 1,
            );

            foldingRanges.push(newFoldingRange);
        }

        foldingRanges.push(new vscode.FoldingRange(
            commentLineNumbers[commentLineNumbers.length - 1],
            document.lineCount - 1
        ));

        return foldingRanges;
    }
}    