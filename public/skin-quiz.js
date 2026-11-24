const skinQuestions = [
  {
    key: 'afterWash',
    prompt: ['بعد غسل وجهكِ بلطف، كيف بتحسّي ببشرتكِ قبل الترطيب؟', 'How does your skin feel after gentle cleansing, before moisturizing?'],
    choices: [
      ['dry', 'مشدودة أو جافة', 'Tight or dry'],
      ['oily', 'بتلمع بسرعة', 'Shiny soon after washing'],
      ['combination', 'خدودي جافة والأنف أو الجبهة بيلمعوا', 'Dry cheeks and a shiny nose or forehead'],
      ['balanced', 'مرتاحة، بدون شدّ أو لمعة واضحة', 'Comfortable, without tightness or noticeable shine']
    ]
  },
  {
    key: 'midday',
    prompt: ['بنصّ اليوم، وين بتلاحظي اللمعة عادةً؟', 'Where do you usually see shine by midday?'],
    choices: [
      ['oily', 'بأغلب الوجه', 'Most of my face'],
      ['combination', 'على الأنف والجبهة والذقن', 'Nose, forehead, and chin'],
      ['dry', 'لمعة قليلة مع جفاف أو شدّ', 'Little shine, with dryness or tightness'],
      ['balanced', 'لمعة خفيفة وبشرتي مرتاحة', 'A little shine, and my skin feels comfortable']
    ]
  },
  {
    key: 'texture',
    prompt: ['بالأيام العادية، إذا ظهر تقشّر خفيف، وين بتلاحظيه؟', 'On a typical day, where do you notice any light flaking?'],
    choices: [
      ['dry', 'بأكثر من منطقة بوجهي', 'In several areas of my face'],
      ['combination', 'بالخدود، وباقي الوجه بيميل للمعة', 'On the cheeks, while other areas tend to shine'],
      ['unknown', 'نادرًا أو ما بلاحظ تقشّر', 'Rarely, or I don’t notice it']
    ]
  },
  {
    key: 'moisture',
    prompt: ['بعد كم ساعة من مرطّبكِ المعتاد، كيف بيكون إحساس بشرتكِ؟', 'A few hours after your usual moisturizer, how does your skin feel?'],
    choices: [
      ['dry', 'برجع الشدّ وبحسّ إني بدي ترطيب', 'Tight again, like I need more moisture'],
      ['oily', 'دهنية أو لامعة بأغلب وجهي', 'Greasy or shiny across most of my face'],
      ['combination', 'خدودي مرتاحة وبترجع اللمعة بوسط الوجه', 'My cheeks feel comfortable and my T-zone gets shiny again'],
      ['balanced', 'بتضل مرتاحة بدون شدّ أو دهنية واضحة', 'Still comfortable, without obvious tightness or oiliness'],
      ['unknown', 'ما بستخدم مرطّب بانتظام أو مش متأكدة', 'I don’t use moisturizer regularly, or I’m not sure']
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

export function quizSkinProfile({afterWash,midday,texture,moisture,sensitive}) {
  const scores = {dry:0,oily:0,combination:0,balanced:0};
  for (const [answer,weight] of [[afterWash,2],[midday,3],[texture,1],[moisture,2]]) {
    if (Object.hasOwn(scores,answer)) scores[answer] += weight;
  }
  const [[type,score],[,nextScore]] = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  // One clue, or competing patterns, isn't enough to recommend a single type.
  const skinType = score >= 4 && score - nextScore >= 2 ? type : 'unknown';
  return {skinType,sensitive:['yes','no'].includes(sensitive)?sensitive:'unknown',area:'face'};
}

export function installSkinQuiz(doc) {
  const entry = doc.querySelector('[data-skin-quiz-entry]');
  if (!entry) return () => {};
  const open = entry.querySelector('button');
  const title = ['اكتشفي بشرتكِ', 'Discover your skin type'];
  const subtitle = ['5 أسئلة قصيرة لتتعرّفي على نوع بشرتكِ', '5 short questions about your skin'];
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
        const progressLabel = label(['السؤال ','Question '])+(step+1)+' / '+skinQuestions.length;
        const progress = element('progress');
        progress.max = skinQuestions.length;
        progress.value = step+1;
        progress.setAttribute('aria-label',progressLabel);
        body.append(element('p',progressLabel,'skin-quiz-progress'),progress);
        const question = element('h3',label(current.prompt));
        const choices = element('div',null,'skin-quiz-answers');
        for (const [key,ar,en] of current.choices) {
          const option = action(label([ar,en]), () => {
            answers[current.key] = key;
            step++;
            render();
          });
          if (answers[current.key] === key) option.classList.add('skin-quiz-selected');
          choices.append(option);
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
          : label(['إجاباتكِ فيها أكثر من نمط، وصعب نرجّح نوعًا واحدًا','Your answers point to more than one skin type']));
        body.append(result);
        if (sensitive === 'yes') body.append(element('p',label(['وبحسب إجاباتكِ، بشرتكِ ممكن تتأثر بسهولة بالمنتجات الجديدة.','Your answers also suggest your skin may react easily to new products.'])));
        body.append(action(label(['إعادة الاختبار','Retake quiz']), () => {for (const question of skinQuestions) delete answers[question.key];step=0;render();}, 'skin-quiz-secondary'));
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
