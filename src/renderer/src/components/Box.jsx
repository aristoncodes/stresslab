// CF-style section: 1px border, grey title strip, padded content.
// `tour` marks the section for the first-launch walkthrough (components/Tour.jsx).
export default function Box({ title, actions, children, className = '', bodyClassName = '', tour }) {
  return (
    <section className={`box ${className}`} data-tour={tour}>
      <div className="box-title">
        <span>{title}</span>
        {actions && <span className="box-actions">{actions}</span>}
      </div>
      <div className={`box-body ${bodyClassName}`}>{children}</div>
    </section>
  )
}
