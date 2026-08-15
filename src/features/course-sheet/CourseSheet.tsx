import type { CourseSheetModel } from "./view-model";

export function CourseSheet({ model }: { model: CourseSheetModel }) {
  return (
    <article className="course-sheet" aria-label="标准文字课式">
      <header>
        <strong>公历 · {model.civilDateTime}</strong>
        <nav aria-label="课式类型"><span aria-current="page">{model.lessonType}</span></nav>
      </header>
      <div className="course-sheet__columns">
        <div>
          <section>
            <h2>三传格局</h2>
            {model.transmissions.map((item) => (
              <p key={item.label}><span>{item.label}</span>　{item.relation}　<strong>{item.value}</strong>　{item.general}</p>
            ))}
          </section>
          <section>
            <h2>四课盘局</h2>
            <div className="course-sheet__lessons">
              {model.lessons.map((item) => (
                <div key={item.label}>
                  <span><span>{item.label}</span> · {item.general}</span>
                  <strong>{item.upper}<i />{item.lower}</strong>
                </div>
              ))}
            </div>
          </section>
        </div>
        <div>
          <section>
            <h2>天地盘式</h2>
            <div className="course-sheet__palaces">
              {model.palaces.map((item) => (
                <div key={item.branch}>
                  <span>{item.general}</span>
                  <strong>{item.heaven}</strong>
                  <small>{item.branch}</small>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2>起课辅助</h2>
            {Object.entries(model.auxiliary).map(([label, value]) => (
              <p key={label}><span>{label}</span>　{value}</p>
            ))}
          </section>
        </div>
      </div>
    </article>
  );
}
