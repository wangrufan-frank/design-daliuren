import "./course-entry.css";

export function CourseLandingPreview() {
  return (
    <section className="course-landing-preview" aria-label="课式生成预览">
      <figure className="course-landing-preview__artifact">
        <div className="course-landing-preview__image"><img src={`${import.meta.env.BASE_URL}images/jade-plate-introduction.webp`} alt="玉石式盘斜俯视图，可见十二神将纹饰与天地盘" width="2400" height="1800" /></div>
        <figcaption><span>玉盘 · 数字器物</span><span>模型实景 / 示例课式</span></figcaption>
      </figure>
      <div className="course-landing-preview__copy">
        <p>传统式盘 · 交互演示</p>
        <h2>大六壬演式</h2>
        <p className="course-landing-preview__motto">观器物之形<br />读课式之序</p>
        <p>从一方玉盘，读懂天地盘、四课与三传的排布。填写起课信息，即可展开属于本课的盘面与文字记录。</p>
      </div>
      <ul className="course-landing-preview__features">
        <li><span aria-hidden="true">观</span><div><h3>三维课式</h3><p>旋转与放大盘面，细看纹饰，点击元素查阅图鉴。</p></div></li>
        <li><span aria-hidden="true">读</span><div><h3>标准文字课式</h3><p>依次阅读本课、十二宫、四课、三传，保存完整图片。</p></div></li>
        <li><span aria-hidden="true">溯</span><div><h3>六阶段依据</h3><p>从历法到天将排列，逐步回看课式的生成依据。</p></div></li>
      </ul>
      <p className="course-landing-preview__guide">填写起课时间、本命与事由，开始观盘。</p>
    </section>
  );
}
