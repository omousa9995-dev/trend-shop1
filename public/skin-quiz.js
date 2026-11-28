import {quizRoutine} from './skin-quiz-routine.js?v=5.23.14';

const unsure = ['unknown', 'مش متأكدة', 'Not sure'];
const skinQuestions = [
  {
    key: 'afterWash',
    theme: ['بعد الغسيل', 'After washing'],
    prompt: ['بعد ما تغسلي وجهكِ، وقبل أي كريم، كيف بتحسّي ببشرتكِ؟', 'After washing your face and before applying cream, how does your skin feel?'],
    choices: [
      ['dry', 'بحسّ بشدّ وبدي أرطّبها فورًا', 'It feels tight and I want to moisturize right away'],
      ['oily', 'ما بحسّ بشدّ واللمعة بترجع بسرعة', 'It feels comfortable and shine returns quickly'],
      ['combination', 'خدودي بيشدّوا بس وسط وجهي مرتاح', 'My cheeks feel tight and the center feels comfortable'],
      ['balanced', 'بتضلّ مرتاحة وملمسها متوازن', 'It stays comfortable and feels balanced'],
      unsure
    ]
  },
  {
    key: 'midday',
    theme: ['خلال اليوم', 'During the day'],
    prompt: ['لما يمرّ نصّ اليوم، وين بتظهر اللمعة على وجهكِ؟', 'By midday, where does shine usually show up on your face?'],
    choices: [
      ['oily', 'بأغلب الوجه', 'Across most of my face'],
      ['combination', 'على الجبهة والأنف والذقن، والخدود أقل', 'On my forehead, nose or chin, less on my cheeks'],
      ['dry', 'لمعة قليلة مع جفاف أو شدّ', 'Little shine, with dryness or tightness'],
      ['balanced', 'لمعة خفيفة وبشرتي مرتاحة', 'A little shine, and my skin feels comfortable'],
      unsure
    ]
  },
  {
    key: 'sensitive',
    theme: ['مع منتج جديد', 'Trying a new product'],
    prompt: ['لما تغيّري غسولكِ أو كريمكِ المعتاد، شو بصير غالبًا؟', 'What usually happens when you switch to a new cleanser or moisturizer?'],
    choices: [['yes', 'بلاحظ احمرار أو لسعة بسهولة', 'I notice redness or stinging easily'], ['no', 'بشرتي عادةً بتتقبّله من غير إزعاج', 'My skin usually tolerates it comfortably'], unsure]
  },
  {
    key: 'goal',
    theme: ['هدفكِ', 'Your goal'],
    prompt: ['لو بدكِ تركّزي على شي واحد هالفترة، شو بتختاري؟', 'If you could focus on one thing right now, what would it be?'],
    choices: [
      ['dryness', 'الترطيب وتخفيف إحساس الشدّ', 'Moisture and a more comfortable feel'],
      ['shine', 'تخفيف مظهر اللمعة', 'Less visible shine'],
      ['tone', 'العناية بمظهر تفاوت اللون', 'Care for uneven-looking tone'],
      ['basic', 'أبدأ بروتين يومي بسيط', 'Starting a simple daily routine'],
      unsure
    ]
  },
  {
    key: 'routine',
    theme: ['وقتكِ', 'Your routine'],
    prompt: ['باليوم العادي، أي روتين أسهل عليكِ تلتزمي فيه؟', 'On a typical day, which routine would be easiest to stick with?'],
    choices: [
      ['simple', 'خطوتين أساسيتين', 'Two essentials'],
      ['am-pm', 'خطوات للصباح والمساء', 'Morning and evening steps'],
      unsure
    ]
  }
];

const skinTypes = {
  dry: ['تميل للجفاف', 'tends to be dry'],
  oily: ['تميل للدهنية', 'tends to be oily'],
  combination: ['تميل للمختلطة', 'tends to be combination'],
  balanced: ['متوازنة', 'appears balanced']
};
const goalLabels = {
  dryness: ['ترطيب وراحة أكثر', 'Moisture and comfort'],
  shine: ['تخفيف مظهر اللمعة', 'Less visible shine'],
  tone: ['العناية بمظهر تفاوت اللون', 'Care for uneven-looking tone'],
  basic: ['بداية بسيطة للعناية', 'A simple starting routine']
};
const title = ['اكتشفي بشرتكِ', 'Discover your skin'];
const intro = ['5 أسئلة قصيرة، وبعدها اختيارات تناسب روتينكِ', '5 short questions, then picks for your routine'];
const analysisTimeMs = 2000;

export function quizSkinProfile({afterWash, midday, sensitive, goal, routine}) {
  const agreed = afterWash === midday && Object.hasOwn(skinTypes, afterWash);
  // Dry cheeks and an oily T-zone can indicate combination skin.
  const combination = afterWash === 'dry' && midday === 'combination' ||
    afterWash === 'combination' && midday === 'dry';
  return {
    area: 'face',
    skinType: agreed ? afterWash : combination ? 'combination' : 'unknown',
    sensitive: sensitive === 'yes' || sensitive === 'no' ? sensitive : 'unknown',
    goal: Object.hasOwn(goalLabels, goal) ? goal : 'basic',
    preferredRoutine: routine === 'am-pm' ? 'am-pm' : 'simple'
  };
}

export function installSkinQuiz(doc, {
  loadCatalog = async () => ({products: []}),
  describeProduct, addProducts, openBag, continueWithLuma
} = {}) {
  const entry = doc.querySelector('[data-skin-quiz-entry]');
  const entryButton = entry?.querySelector('button');
  let locale = 'ar';
  let currentPage;
  let dialog;
  const label = pair => pair[Number(locale === 'en')];
  function element(tag, text, className) {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function action(text, click, className) {
    const node = element('button', text, className);
    node.type = 'button';
    node.onclick = click;
    return node;
  }
  function link(text, href, className) {
    const node = element('a', text, className);
    node.href = href;
    node.onclick = () => dialog?.close();
    return node;
  }
  function productCard({product, time, reason}) {
    const {name, href, image, price} = describeProduct(product);
    const card = element('article', null, 'skin-quiz-product');
    const photo = element('img');
    if (image) photo.src = image;
    else photo.hidden = true;
    photo.alt = '';
    photo.width = 64;
    photo.height = 72;
    photo.loading = 'lazy';
    const info = element('div');
    const nameLink = link(name, href, 'skin-quiz-product-name');
    nameLink.dir = 'auto';
    info.append(element('span', label(time), 'skin-quiz-step-label'), nameLink,
      element('p', label(reason)), element('strong', price));
    if (image) card.append(photo);
    else card.classList.add('skin-quiz-product-text');
    card.append(info);
    return card;
  }

  function open(trigger = entryButton) {
    if (dialog) return;
    const answers = {};
    let step = 0;
    let request;
    let analysisTimer;
    let restoreFocus = true;
    const modal = element('dialog', null, 'skin-quiz-dialog');
    dialog = modal;
    modal.id = 'skinQuizDialog';
    modal.dataset.noTranslate = '';
    modal.lang = locale;
    modal.dir = locale === 'en' ? 'ltr' : 'rtl';
    modal.setAttribute('aria-labelledby', 'skinQuizTitle');
    const heading = element('h2', label(title));
    heading.id = 'skinQuizTitle';
    const header = element('header');
    header.append(heading, action(label(['إغلاق', 'Close']), () => modal.close(), 'skin-quiz-close'));
    const body = element('div', null, 'skin-quiz-body');
    modal.append(header, body);
    modal.addEventListener('close', () => {
      clearTimeout(analysisTimer);
      request?.abort();
      modal.remove();
      if (dialog === modal) dialog = undefined;
      if (restoreFocus && trigger?.isConnected && !trigger.closest('[hidden]')) trigger.focus({preventScroll: true});
    }, {once: true});

    function startRequest() {
      request?.abort();
      request = new AbortController();
      return request;
    }
    const current = controller => dialog === modal && modal.open && !controller.signal.aborted;
    const deadline = controller => AbortSignal.any([controller.signal, AbortSignal.timeout(6500)]);
    function focusTitle(node) {
      modal.scrollTop = 0;
      node.tabIndex = -1;
      node.focus({preventScroll: true});
    }

    function selection(profile, panel, snapshot, updated = false) {
      const products = describeProduct ? quizRoutine(snapshot.products, profile) : [];
      panel.replaceChildren();
      const status = element('p', updated ? label([
        'حدّثنا الترشيحات لتطابق السعر والتوفّر الآن. راجعيها قبل الإضافة.',
        'The picks now reflect current prices and availability. Review them before adding.'
      ]) : null, 'skin-quiz-status');
      status.setAttribute('role', 'status');
      panel.append(status);
      if (!products.length) {
        panel.append(element('p', label([
          'هاي بداية مقترحة لروتينكِ. تقدري تتصفّحي خيارات العناية المتوفرة.',
          'Use these steps as a starting point and browse the skincare choices available.'
        ])), link(label(['تصفّحي العناية بالبشرة', 'Browse skincare']), '#/shop?cat=%D8%A7%D9%84%D8%A8%D8%B4%D8%B1%D8%A9'));
        return;
      }
      panel.append(element('h4', label(['اختيارات لروتينكِ', 'Picks for your routine'])));
      const cards = element('div', null, 'skin-quiz-products');
      cards.append(...products.map(productCard));
      panel.append(cards);
      if (!addProducts) return;
      const add = action(label(['أضيفي الاختيارات للسلة', 'Add these picks to your bag']), async () => {
        const controller = startRequest();
        add.disabled = true;
        status.textContent = label(['بنتأكد من التوفّر…', 'Checking availability…']);
        try {
          const items = products.map(({product}) => ({id: product.id, priceFils: product.priceFils ?? product.price_fils}));
          const outcome = await addProducts(items, deadline(controller));
          if (!current(controller)) return;
          if (outcome.updated) {
            selection(profile, panel, outcome.updated, true);
            panel.querySelector('button, a')?.focus();
            return;
          }
          status.textContent = outcome.message;
          if (outcome.ok) {
            const review = action(label(['راجعي السلة', 'Review your bag']), () => {
              restoreFocus = false;
              modal.close();
              openBag?.();
            }, 'skin-quiz-primary');
            add.replaceWith(review);
            review.focus();
          }
        } catch {
          if (current(controller)) status.textContent = label(['تعذّر تأكيد التوفّر. جرّبي مرة ثانية.', 'Availability could not be checked. Try again.']);
        } finally {
          add.disabled = false;
        }
      }, 'skin-quiz-primary');
      panel.append(add);
    }

    function readCatalog(controller) {
      return Promise.resolve().then(() => loadCatalog(deadline(controller))).catch(() => null);
    }

    async function loadSelection(profile, panel, controller = startRequest(), catalog = readCatalog(controller)) {
      const progress = element('p', label(['بنشوف شو متوفر لروتينكِ…', 'Checking what is available for your routine…']), 'skin-quiz-status');
      progress.setAttribute('role', 'status');
      panel.replaceChildren(progress);
      const snapshot = await catalog;
      if (!current(controller)) return;
      if (snapshot) {
        selection(profile, panel, snapshot);
        return;
      }
      progress.textContent = label(['ما قدرنا نقرأ التوفّر هالمرة. نتيجتكِ جاهزة فوق.', 'We could not check availability this time. Your result is above.']);
      panel.append(action(label(['أعيدي المحاولة', 'Try again']), () => loadSelection(profile, panel), 'skin-quiz-secondary'));
    }

    function analyze() {
      const profile = quizSkinProfile(answers);
      const controller = startRequest();
      const catalog = readCatalog(controller);
      const panel = element('div', null, 'skin-quiz-analysis');
      const icon = element('span', '✦', 'skin-quiz-analysis-icon');
      icon.setAttribute('aria-hidden', 'true');
      const caption = element('h3', label(['بنحلّل إجاباتكِ…', 'Analyzing your answers…']));
      panel.append(icon, caption);
      body.append(panel);
      focusTitle(caption);
      analysisTimer = setTimeout(() => {
        if (current(controller)) result(profile, controller, catalog);
      }, analysisTimeMs);
    }

    function result(profile, controller, catalog) {
      const type = skinTypes[profile.skinType];
      const summary = element('h3', type
        ? label(['بشرتكِ على الأغلب ', 'Your skin most likely ']) + label(type)
        : label(['إجاباتكِ بتشير لأكثر من نمط', 'Your answers point to more than one pattern']));
      const overview = element('section', null, 'skin-quiz-summary');
      overview.append(summary, element('p', label(['هدفكِ · ', 'Your focus · ']) + label(goalLabels[profile.goal])));
      if (profile.sensitive === 'yes') overview.append(element('p', label([
        'إجاباتكِ بتشير إنها ممكن تتأثر بسهولة. ابدئي بإضافة منتج واحد كل مرة.',
        'Your answers suggest it may react easily. Introduce one new product at a time.'
      ])));
      overview.append(element('small', label(['تقدير حسب إجاباتكِ', 'Based on your answers'])));
      const plan = element('section', null, 'skin-quiz-plan');
      plan.append(element('h4', label(['صباحًا', 'Morning'])),
        element('p', label(['ترطيب، وبعده واقي شمس.', 'Moisturize, then apply sunscreen.'])),
        element('h4', label(['مساءً', 'Evening'])),
        element('p', label(['تنظيف لطيف، وبعده ترطيب.', 'Cleanse gently, then moisturize.'])));
      const choices = element('section', null, 'skin-quiz-routine');
      const actions = element('div', null, 'skin-quiz-actions');
      actions.append(action(label(['عدّلي إجاباتكِ', 'Edit answers']), () => {step = skinQuestions.length - 1; render();}, 'skin-quiz-secondary'),
        action(label(['إعادة الاختبار', 'Retake quiz']), () => {
          for (const key of Object.keys(answers)) delete answers[key];
          step = 0;
          render();
        }, 'skin-quiz-secondary'));
      body.replaceChildren(overview, plan);
      if (continueWithLuma) {
        const luma = action(null, () => continueWithLuma(profile), 'skin-quiz-luma');
        const avatar = element('img');
        avatar.src = '/images/editorial/beauty-hero-v2.webp';
        avatar.alt = '';
        avatar.width = avatar.height = 42;
        const copy = element('span');
        copy.append(element('strong', label(['كمّلي مع لُمى', 'Continue with Luma'])),
          element('small', label(['اسأليها عن روتينكِ بناءً على إجاباتكِ', 'Ask about your routine using your quiz answers'])));
        const arrow = element('span', label(['←', '→']), 'skin-quiz-luma-arrow');
        arrow.setAttribute('aria-hidden', 'true');
        luma.append(avatar, copy, arrow);
        body.append(luma);
      }
      body.append(choices, actions);
      focusTitle(summary);
      void loadSelection(profile, choices, controller, catalog);
    }

    function render() {
      clearTimeout(analysisTimer);
      request?.abort();
      body.replaceChildren();
      const question = skinQuestions[step];
      if (!question) { analyze(); return; }
      const meter = element('div', null, 'skin-quiz-meter');
      const progressText = label(['السؤال ', 'Question ']) + (step + 1) + label([' من ', ' of ']) + skinQuestions.length;
      meter.append(element('span', label(question.theme)), element('span', progressText));
      const progress = element('progress');
      progress.max = skinQuestions.length;
      progress.value = step + 1;
      progress.setAttribute('aria-label', progressText);
      body.append(meter, progress);
      const prompt = element('h3', label(question.prompt));
      const choices = element('div', null, 'skin-quiz-answers');
      choices.setAttribute('role', 'group');
      choices.setAttribute('aria-label', label(question.prompt));
      for (const [key, ar, en] of question.choices) {
        const option = action(label([ar, en]), () => { answers[question.key] = key; step++; render(); });
        const selected = answers[question.key] === key;
        option.classList.toggle('skin-quiz-selected', selected);
        option.setAttribute('aria-pressed', String(selected));
        choices.append(option);
      }
      body.append(prompt, choices);
      if (step > 0) body.append(action(label(['السابق', 'Back']), () => {step--; render();}, 'skin-quiz-secondary'));
      focusTitle(prompt);
    }
    doc.body.append(modal);
    modal.showModal();
    render();
  }

  if (entryButton) entryButton.onclick = () => open();
  return {
    open,
    update(visible, language, page = visible ? 'home' : 'other') {
      const nextLocale = language === 'en' ? 'en' : 'ar';
      if (dialog?.open && (page !== currentPage || nextLocale !== locale)) dialog.close();
      currentPage = page;
      locale = nextLocale;
      if (!entry) return;
      entry.hidden = !visible;
      entryButton.querySelector('strong').textContent = label(title);
      entryButton.querySelector('small').textContent = label(intro);
    }
  };
}
