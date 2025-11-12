import "./ConfigErrorModal.css";

interface ConfigErrorModalProps {
  visible: boolean;
  onDismiss: () => void;
  onOpenSettings: () => void;
  errorCode?: string;
  errorMessage?: string;
  provider?: string | null;
}

export function ConfigErrorModal({
  visible,
  onDismiss,
  onOpenSettings,
  errorCode,
  errorMessage,
  provider,
}: ConfigErrorModalProps) {
  if (!visible) return null;

  return (
    <div
      className="config-error-modal__backdrop"
      role="alertdialog"
      aria-modal="true"
      data-testid="config-error-modal"
    >
      <div className="config-error-modal__card">
        <h2>LLM 服务不可用</h2>
        <p>
          Muse / Loki 在请求 LLM 时失败了。{provider ? `${provider} 返回:` : ""}{" "}
          {errorMessage || "后端没有可用的 API Key。"}
        </p>
        <ol>
          <li>
            如果你在本地运行后端，可在 <code>server/.env</code> 中配置云厂商 API Key。
          </li>
          <li>
            或者，点击「LLM 设置」把你自己的 key 存在浏览器里，并选择想用的厂商。
          </li>
          <li>刷新或重试介入按钮即可重新发起请求。</li>
        </ol>
        {errorCode && (
          <p className="config-error-modal__meta">
            错误代码: <code>{errorCode}</code>
          </p>
        )}
        <div className="config-error-modal__actions">
          <button
            type="button"
            onClick={onOpenSettings}
            className="config-error-modal__button secondary"
            data-testid="config-error-open-settings"
          >
            打开 LLM 设置
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="config-error-modal__button"
            data-testid="config-error-dismiss"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}
