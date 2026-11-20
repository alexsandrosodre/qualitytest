import type { PageDiagnostics } from './types';

const NOT_AVAILABLE = 'Não disponível';

/** Dimensões (em pixels) da captura de tela, quando disponíveis. */
interface DiagnosticsOptions {
  imageWidth?: number;
  imageHeight?: number;
}

/**
 * Coleta dados técnicos permitidos da aba em foco (seção 6.3 do doc de
 * estratégia). NUNCA lê senhas, cookies, tokens, conteúdo de formulários ou
 * dados pessoais: apenas URL, título e características do navegador/SO.
 */
export function collectPageDiagnostics(
  tab: chrome.tabs.Tab,
  options: DiagnosticsOptions = {},
): PageDiagnostics {
  const userAgent = navigator.userAgent;
  return {
    pageUrl: tab.url ?? NOT_AVAILABLE,
    pageTitle: tab.title ?? NOT_AVAILABLE,
    browserInfo: parseBrowserInfo(userAgent),
    operatingSystemInfo: parseOperatingSystemInfo(userAgent),
    viewportInfo: formatViewport(options),
  };
}

interface UserAgentRule {
  name: string;
  regex: RegExp;
}

/** Extrai navegador e versão do user agent (procurando o mais específico primeiro). */
function parseBrowserInfo(userAgent: string): string {
  const rules: readonly UserAgentRule[] = [
    { name: 'Edge', regex: /Edg\/([\d.]+)/ },
    { name: 'Chrome', regex: /Chrome\/([\d.]+)/ },
    { name: 'Firefox', regex: /Firefox\/([\d.]+)/ },
    { name: 'Safari', regex: /Version\/([\d.]+).*Safari/ },
  ];
  for (const rule of rules) {
    const match = rule.regex.exec(userAgent);
    const version = match?.[1];
    if (version) {
      return `${rule.name} ${version}`;
    }
  }
  return NOT_AVAILABLE;
}

/** Extrai sistema operacional e versão do user agent, quando determinável. */
function parseOperatingSystemInfo(userAgent: string): string {
  const rules: readonly UserAgentRule[] = [
    { name: 'Windows', regex: /Windows NT ([\d.]+)/ },
    { name: 'Android', regex: /Android ([\d.]+)/ },
    { name: 'iOS', regex: /OS ([\d_]+) like Mac OS X/ },
    { name: 'macOS', regex: /Mac OS X ([\d_]+)/ },
    { name: 'Linux', regex: /Linux/ },
  ];
  for (const rule of rules) {
    const match = rule.regex.exec(userAgent);
    if (match) {
      const version = match[1]?.replace(/_/g, '.');
      return version ? `${rule.name} ${version}` : rule.name;
    }
  }
  return NOT_AVAILABLE;
}

/** Formata as dimensões da captura como `largura x altura`. */
function formatViewport(options: DiagnosticsOptions): string | undefined {
  const { imageWidth, imageHeight } = options;
  if (
    typeof imageWidth === 'number' &&
    typeof imageHeight === 'number' &&
    imageWidth > 0 &&
    imageHeight > 0
  ) {
    return `${imageWidth}x${imageHeight}`;
  }
  return undefined;
}
