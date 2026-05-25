/**
 * 从 Markdown 文件的 Front Matter 中提取侧边栏显示配置
 * 并生成静态的配置文件
 *
 * 支持的 Front Matter 字段：
 * - sidebar_versions: 该文档在哪些版本下显示（逗号分隔，支持 >、>=、<、<= 与精确版本）
 * - sidebar_products: 该文档在哪些产品下显示（逗号分隔）；RDK X5 精确匹配，RDK-X5 匹配 RDK X5 系列
 * - sidebar_only: 该文档仅在特定版本/产品下显示（优先级最高）
 *
 * 示例：
 * ---
 * sidebar_versions: 3.0.0,3.5.0
 * sidebar_products: RDK X3,RDK X5
 * ---
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { collectDocScopeKeys } from '../context/doc-scope-id-utils.js';
import { normalizeScopeProductList } from '../context/doc-scope-product-utils.js';
import { parseVersionScopeList } from '../context/doc-scope-version-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configFilePath = path.join(__dirname, '../context/generated-sidebar-config.json');

// 确保目录存在
const configDir = path.dirname(configFilePath);
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// 初始化配置
let generatedConfig = {};
try {
  if (fs.existsSync(configFilePath)) {
    const existing = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
    generatedConfig = existing;
  }
} catch (e) {
  generatedConfig = {};
}

function parseScopeList(value) {
  if (value == null) return [];
  const s = String(value).trim();
  if (s === '' || s === '*') return [];
  return s
    .split(/[,，]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * 保存配置到文件
 */
function saveConfig() {
  try {
    fs.writeFileSync(configFilePath, JSON.stringify(generatedConfig, null, 2), 'utf-8');
  } catch (e) {
    console.error('保存侧边栏配置失败:', e);
  }
}

/** @returns {import('unified').Plugin} */
export default function remarkGenerateSidebarConfig() {
  return (tree, file) => {
    // 获取 Front Matter
    const frontmatter = file.data?.frontMatter || {};
    
    // 只处理有侧边栏配置的文档
    if (!frontmatter.sidebar_versions && !frontmatter.sidebar_products) {
      return;
    }

    // 获取文档相对路径（用于路径 key + front matter id 双 key 注册）
    let relativePath = '';
    if (file.path) {
      const filePath = file.path;
      const match = filePath.match(/docs[/\\](.*?)\.md$/);
      if (match) {
        relativePath = match[1].replace(/[/\\]/g, '/');
      } else {
        const matchI18n = filePath.match(/docusaurus-plugin-content-docs[/\\]current[/\\](.*?)\.md$/);
        if (matchI18n) {
          relativePath = matchI18n[1].replace(/[/\\]/g, '/');
        }
      }
    }

    if (!relativePath) {
      return;
    }

    const scopeKeys = collectDocScopeKeys(relativePath, frontmatter.id);

    // 解析侧边栏控制字段（产品名与矩阵不区分大小写，写入前尽量规范化为矩阵内写法）
    const sidebarData = {
      versions: parseVersionScopeList(frontmatter.sidebar_versions),
      products: normalizeScopeProductList(parseScopeList(frontmatter.sidebar_products)),
    };

    // 同时写入路径 key 与 front matter id key
    for (const key of scopeKeys) {
      generatedConfig[key] = sidebarData;
    }
    
    // 保存配置
    saveConfig();
  };
}

// 导出配置文件路径供其他模块使用
export { configFilePath };
