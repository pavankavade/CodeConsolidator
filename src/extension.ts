import * as vscode from 'vscode';
import * as path from 'path';
import ignore from 'ignore';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('extension.extractAllCode', async () => {
        if (!vscode.workspace.workspaceFolders) {
            vscode.window.showErrorMessage('Please open a folder/workspace first.');
            return;
        }

        // Assume the first workspace folder as the root
        const workspaceFolder = vscode.workspace.workspaceFolders[0];
        const workspaceRoot = workspaceFolder.uri.fsPath;

        // Load .gitignore if it exists in the workspace root
        const gitignoreFilter = await loadGitignoreFilter(workspaceRoot);

        // Updated file pattern to include HTML files
        const pattern = '**/*.{js,ts,jsx,tsx,py,cpp,cs,java,html}';
        const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');

        if (!files || files.length === 0) {
            vscode.window.showInformationMessage('No code files found.');
            return;
        }

        let consolidatedContent = '';
        for (const fileUri of files) {
            try {
                // Compute the file's relative path for both display and gitignore check
                const relativePath = path.relative(workspaceRoot, fileUri.fsPath);

                // Skip the file if it is ignored by .gitignore rules
                if (gitignoreFilter && gitignoreFilter.ignores(relativePath)) {
                    continue;
                }

                // Open the document to read the file's content
                const document = await vscode.workspace.openTextDocument(fileUri);
                const fileContent = document.getText();

                // Append header and content
                consolidatedContent += `\n=========== FILE: ${relativePath} ===========\n`;
                consolidatedContent += fileContent;
                consolidatedContent += '\n\n';
            } catch (err) {
                vscode.window.showErrorMessage(`Error reading file ${fileUri.fsPath}: ${err}`);
            }
        }

        // Define the destination file path in the workspace root
        const destinationPath = path.join(workspaceRoot, 'allcodetext.txt');
        const destinationUri = vscode.Uri.file(destinationPath);

        // Write the consolidated content to allcodetext.txt file in the workspace root
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(consolidatedContent);
        try {
            await vscode.workspace.fs.writeFile(destinationUri, uint8Array);
            vscode.window.showInformationMessage(`Code extracted successfully to ${destinationPath}`);
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to write file: ${err}`);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}

/**
 * Load the .gitignore file from the given root path and
 * create an "ignore" instance that can be used to test paths.
 */
async function loadGitignoreFilter(rootPath: string): Promise<ignore.Ignore | null> {
    const gitignorePath = path.join(rootPath, '.gitignore');
    try {
        const fileUri = vscode.Uri.file(gitignorePath);
        // Read the .gitignore file. If it doesn't exist, an error will be thrown.
        const fileData = await vscode.workspace.fs.readFile(fileUri);
        const content = Buffer.from(fileData).toString('utf8');
        const ig = ignore().add(content);
        return ig;
    } catch (error) {
        // .gitignore doesn't exist or can't be read; return null so that no files are ignored.
        return null;
    }
}