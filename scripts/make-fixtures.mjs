#!/usr/bin/env node
/** Write the synthetic demo.hello and broken.vsix fixtures used in the recording. */
import { writeFile } from "node:fs/promises";
import {
  TextReader,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipWriter,
} from "@zip.js/zip.js";

const CONTENT_TYPES = `<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json" />
  <Default Extension="vsixmanifest" ContentType="text/xml" />
  <Default Extension="js" ContentType="application/javascript" />
</Types>
`;

const vsixManifest = `<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Id="demo.hello" Version="1.2.3" Publisher="demo" TargetPlatform="win32-x64" />
    <DisplayName>Hello Demo</DisplayName>
    <Description xml:space="preserve">A tiny fixture extension.</Description>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.74.0" />
    </Properties>
  </Metadata>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" />
  </Assets>
</PackageManifest>
`;

const packageJson = `{
  "name": "hello",
  "publisher": "demo",
  "version": "1.2.3",
  "engines": { "vscode": "^1.74.0" },
  "main": "./out/extension.js",
  "activationEvents": ["onCommand:demo.hello", "*", "onStartupFinished"]
}
`;

const addText = async (writer, name, text) => {
  await writer.add(name, new TextReader(text), { level: 0 });
};

const build = async (manifest, signed) => {
  const writer = new ZipWriter(new Uint8ArrayWriter());
  await addText(writer, "[Content_Types].xml", CONTENT_TYPES);
  await addText(writer, "extension.vsixmanifest", manifest);
  await addText(writer, "extension/package.json", packageJson);
  await addText(writer, "extension/out/extension.js", "exports.activate = () => {};");
  if (signed) {
    await writer.add(
      "extension.signature.p7s",
      new Uint8ArrayReader(Uint8Array.from([0x30, 0x80, 0x06, 0x09])),
      { level: 0 },
    );
    await addText(writer, ".signature.manifest", '{"package":"unsigned"}');
  }
  return writer.close();
};

const out = process.argv[2] ?? "/tmp/vsix-demo";
const good = await build(vsixManifest, true);
await writeFile(`${out}/demo.hello-1.2.3.vsix`, good);
const bad = await build("<PackageManifest><Metadata><Identity Id='broken'", false);
await writeFile(`${out}/broken.vsix`, bad);
await writeFile(`${out}/not-an-extension.vsix`, "not a zip");
console.log("wrote fixtures", good.length, bad.length);
