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
        <p>可追溯的数字器物</p>
        <h2>从占时到课式，回看每一步依据</h2>
        <p>输入起课时间，生成可回看依据的三维课式与标准文字课式。</p>
        <ul>
          <li>三维课式</li>
          <li>标准文字课式</li>
          <li>六阶段依据</li>
        </ul>
      </div>
    </section>
  );
}
