const skinQuestions = [
  {
    key: 'afterWash',
    prompt: ['بعد غسل وجهكِ بلطف، كيف بتحسّي ببشرتكِ قبل الترطيب؟', 'How does your skin feel after gentle cleansing, before moisturizing?'],
    choices: [
      ['tight', 'مشدودة أو جافة', 'Tight or dry'],
      ['shine', 'بتلمع بسرعة', 'Shiny soon after washing'],
      ['mixed', 'خدودي جافة والأنف أو الجبهة بيلمعوا', 'Dry cheeks and a shiny nose or forehead'],
      ['comfortable', 'مرتاحة', 'Comfortable']
    ]
  },
  {
    key: 'midday',
    prompt: ['بنصّ اليوم، وين بتلاحظي اللمعة عادةً؟', 'Where do you usually see shine by midday?'],
    choices: [
      ['all', 'بأغلب الوجه', 'Most of my face'],
      ['tzone', 'على الأنف والجبهة والذقن', 'Nose, forehead, and chin'],
      ['none', 'لمعة قليلة مع جفاف أو شدّ', 'Little shine, with dryness or tightness'],
      ['balanced', 'لمعة خفيفة وبشرتي مرتاحة', 'A little shine, and my skin feels comfortable']
    ]
  },
  {
    key: 'sensitive',
    prompt: ['المنتجات الجديدة بتسبب لكِ احمرار أو لسعة بسهولة؟', 'Do new products often cause redness or stinging?'],
    choices: [
      ['yes', 'غالبًا', 'Often'],
      ['no', 'نادرًا', 'Rarely'],
      ['unknown', 'مش متأكدة', 'Not sure']
    ]
  }
];

const types = {
  dry: ['جافة', 'dry'],
  oily: ['دهنية', 'oily'],
  combination: ['مختلطة', 'combination'],
  balanced: ['متوازنة', 'balanced']
};

export function quizSkinProfile({afterWash,midday,sensitive}) {
  let skinType = 'unknown';
  if (afterWash === 'mixed' || midday === 'tzone') skinType = 'combination';
  else if (midday === 'all' && afterWash !== 'tight') skinType = 'oily';
  else if (midday === 'none' && afterWash === 'tight') skinType = 'dry';
  else if (midday === 'balanced' && afterWash === 'comfortable') skinType = 'balanced';
  return {skinType,sensitive:['yes','no'].includes(sensitive)?sensitive:'unknown',area:'face'};
}

export function installSkinQuiz(doc) {
  const entry = doc.querySelector('[data-skin-quiz-entry]');
  if (!entry) return () => {};
  const open = entry.querySelector('button');
  const title = ['اكتشفي بشرتكِ', 'Discover your skin type'];
  const subtitle = ['3 أسئلة قصيرة لتتعرّفي على نوع بشرتكِ', '3 short questions about your skin'];
  let language = 0;
  let dialog;
  const label = pair => pair[language];
  function element(tag,text,className) {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function action(text,click,className) {
    const node = element('button',text,className);
    node.type = 'button';
    node.onclick = click;
    return node;
  }
  open.onclick = () => {
    if (dialog) return;
    const answers = {};
    let step = 0;
    dialog = element('dialog',null,'skin-quiz-dialog');
    dialog.setAttribute('aria-labelledby','skinQuizTitle');
    dialog.dataset.noTranslate = '';
    const heading = element('h2',label(title));
    heading.id = 'skinQuizTitle';
    const header = element('header');
    header.append(heading, action(label(['إغلاق','Close']), () => dialog.close(), 'skin-quiz-close'));
    const body = element('div',null,'skin-quiz-body');
    dialog.append(header,body);
    dialog.addEventListener('close', () => {
      dialog.remove();
      dialog = undefined;
      if (!entry.hidden) open.focus({preventScroll:true});
    }, {once:true});
    function render() {
      const current = skinQuestions[step];
      body.replaceChildren();
      if (current) {
        body.append(element('p',label(['السؤال ','Question '])+(step+1)+' / '+skinQuestions.length,'skin-quiz-progress'));
        const question = element('h3',label(current.prompt));
        const choices = element('div',null,'skin-quiz-answers');
        for (const [key,ar,en] of current.choices) {
          choices.append(action(label([ar,en]), () => {
            answers[current.key] = key;
            step++;
            render();
          }));
        }
        body.append(question,choices);
        if (step>0) body.append(action(label(['السابق','Back']), () => {step--;render();}, 'skin-quiz-secondary'));
        question.tabIndex = -1;
        question.focus();
      } else {
        const {skinType,sensitive} = quizSkinProfile(answers);
        const type = types[skinType]?.[language];
        const result = element('h3',type
          ? label(['نوع بشرتكِ على الأغلب ','Your skin is likely '])+type
          : label(['إجاباتكِ مختلطة، وصعب نرجّح نوعًا واحدًا','Your answers point to more than one skin type']));
        body.append(result);
        if (sensitive === 'yes') body.append(element('p',label(['وبحسب إجاباتكِ، بشرتكِ ممكن تتأثر بسهولة بالمنتجات الجديدة.','Your answers also suggest your skin may react easily to new products.'])));
        body.append(action(label(['إعادة الاختبار','Retake quiz']), () => {step=0;render();}, 'skin-quiz-secondary'));
        result.tabIndex = -1;
        result.focus();
      }
    }
    doc.body.append(dialog);
    dialog.showModal();
    render();
  };
  return (visible,locale) => {
    language = locale === 'en' ? 1 : 0;
    entry.hidden = !visible;
    open.querySelector('strong').textContent = label(title);
    open.querySelector('small').textContent = label(subtitle);
    if (!visible && dialog?.open) dialog.close();
  };
}
