// Keep the Web and WeChat clients on the same generated OpenAPI contract.
// A declaration file under the mini-program root has no runtime or package output.
const { copyFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..');
mkdirSync(join(root, '.api-contract'), { recursive: true });
copyFileSync(join(root, '../client/src/types/api.generated.ts'), join(root, '.api-contract/schema.d.ts'));
