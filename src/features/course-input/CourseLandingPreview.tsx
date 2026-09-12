import "./course-entry.css";

export function CourseLandingPreview() {
  return (
    <section className="course-landing-preview" aria-label="课式生成预览">
      <div className="course-landing-preview__artifact" aria-hidden="true">
        <span data-ring="heaven" />
        <span data-ring="earth" />
        <i data-axis="vertical" />
        <i data-axis="horizontal" />
      </div>
      <div className="course-landing-preview__copy">
        <p>起课 · 观盘 · 读课式</p>
        <h2>填写信息<br />展开一课</h2>
        <p>填写北京时间、出生年份和事由，即可查看三维式盘与文字课式；文字课式支持保存为图片。</p>
        <ul>
          <li>三维课式</li>
          <li>标准文字课式</li>
          <li>六阶段依据</li>
        </ul>
      </div>
    </section>
  );
}
