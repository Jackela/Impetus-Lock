import "./ConfigErrorModal.css";

interface ConfigErrorModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function ConfigErrorModal({ visible, onDismiss }: ConfigErrorModalProps) {
  if (!visible) return null;

  return (
    <div className="config-error-modal__backdrop" role="alertdialog" aria-modal="true">
      <div className="config-error-modal__card">
        <h2>LLM API 未配置</h2>
        <p>
          后端返回 <code>ConfigurationError</code>，表示 <code>OPENAI_API_KEY</code> 尚未设置。
          没有有效的 API Key，Muse/Loki 将无法生成内容。
        </p>
        <ol>
          <li>在 <code>server/.env</code> 中添加有效的 <code>OPENAI_API_KEY</code>.</li>
          <li>重启 FastAPI 服务器（例如运行 <code>server/start_server.sh</code>）。</li>
          <li>刷新页面后再次尝试触发 AI 介入。</li>
        </ol>
        <button type="button" onClick={onDismiss} className="config-error-modal__button">
          我知道了
        </button>
      </div>
    </div>
  );
}
