import {quizRoutine} from './skin-quiz-routine.js?v=5.23.14';

const unsure = ['unknown', 'مش متأكدة', 'Not sure'];
const skinQuestions = [
  {
    key: 'afterWash',
    prompt: ['بعد غسل وجهكِ بلطف وقبل الترطيب، كيف بتحسّي ببشرتكِ؟', 'How does your skin feel after gentle cleansing, before moisturizing?'],
    choices: [
      ['dry', 'مشدودة أو جافة', 'Tight or dry'],
      ['oily', 'بتلمع بأغلب الوجه', 'Shiny across most of my face'],
      ['combination', 'الخدود جافة ووسط الوجه بيلمع', 'Dry cheeks and a shiny T-zone'],
      ['balanced', 'مرتاحة، بدون شدّ أو لمعة واضحة', 'Comfortable, without tightness or noticeable shine'],
      unsure
    ]
  },
  {
    key: 'midday',
    prompt: ['بنصّ اليوم، وين بتلاحظي اللمعة عادةً؟', 'Where do you usually see shine by midday?'],
    choices: [
      ['oily', 'بأغلب الوجه', 'Across most of my face'],
      ['combination', 'على الأنف والجبهة أو الذقن', 'On my nose, forehead, or chin'],
      ['dry', 'لمعة قليلة مع جفاف أو شدّ', 'Little shine, with dryness or tightness'],
      ['balanced', 'لمعة خفيفة وبشرتي مرتاحة', 'A little shine, and my skin feels comfortable'],
      unsure
    ]
  },
  {
    key: 'sensitive',
    prompt: ['لما تجرّبي منتجًا جديدًا، بتلاحظي احمرار أو لسعة بسهولة؟', 'When you try a new product, does your skin get red or sting easily?'],
    choices: [['yes', 'غالبًا', 'Often'], ['no', 'نادرًا', 'Rarely'], unsure]
  },
  {
    key: 'goal',
    prompt: ['شو أكثر شي حابة تهتمي فيه هالفترة؟', 'What would you most like to focus on right now?'],
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
    prompt: ['كيف بتحبّي يكون روتينكِ؟', 'How would you like to organize your routine?'],
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

    async function loadSelection(profile, panel) {
      const controller = startRequest();
      const progress = element('p', label(['بنشوف شو متوفر لروتينكِ…', 'Checking what is available for your routine…']), 'skin-quiz-status');
      progress.setAttribute('role', 'status');
      panel.replaceChildren(progress);
      try {
        const catalog = await loadCatalog(deadline(controller));
        if (current(controller)) selection(profile, panel, catalog);
      } catch {
        if (!current(controller)) return;
        progress.textContent = label(['ما قدرنا نقرأ التوفّر هالمرة. نتيجتكِ جاهزة فوق.', 'We could not check availability this time. Your result is above.']);
        panel.append(action(label(['أعيدي المحاولة', 'Try again']), () => loadSelection(profile, panel), 'skin-quiz-secondary'));
      }
    }

    function result() {
      const profile = quizSkinProfile(answers);
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
      if (continueWithLuma) actions.append(action(label(['كمّلي مع لُمى', 'Continue with Luma']),
        () => continueWithLuma(profile), 'skin-quiz-secondary'));
      body.append(overview, plan, choices, actions);
      focusTitle(summary);
      void loadSelection(profile, choices);
    }

    function render() {
      request?.abort();
      body.replaceChildren();
      const question = skinQuestions[step];
      if (!question) { result(); return; }
      if (step === 0) body.append(element('p', label(intro), 'skin-quiz-intro'));
      const progressText = label(['السؤال ', 'Question ']) + (step + 1) + ' / ' + skinQuestions.length;
      const progress = element('progress');
      progress.max = skinQuestions.length;
      progress.value = step + 1;
      progress.setAttribute('aria-label', progressText);
      body.append(element('p', progressText, 'skin-quiz-progress'), progress);
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
