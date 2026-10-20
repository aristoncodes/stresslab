// CF-style section: 1px border, grey title strip, padded content.
export default function Box({ title, actions, children, className = '', bodyClassName = '' }) {
  return (
    <section className={`box ${className}`}>
      <div className="box-title">
        <span>{title}</span>
        {actions && <span className="box-actions">{actions}</span>}
      </div>
      <div className={`box-body ${bodyClassName}`}>{children}</div>
    </section>
  )
}
