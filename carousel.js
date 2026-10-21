import { promotionSlides, slideMarkup, PROMOTION_INTERVAL } from './promotions.js';

export function initCarousel(root) {
  if (!root) return null;
  const stage = root.querySelector('.carousel-stage');
  const controls = root.querySelector('.carousel-controls');
  const dots = root.querySelector('.carousel-dots');
  const playButton = root.querySelector('[data-carousel-toggle]');
  const announcement = root.querySelector('.carousel-announcement');
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let slides = Array.from(stage.children);
  let signature = '';
  let index = 0, lang = 'ru', timer = null, intervalMs = PROMOTION_INTERVAL, lastConfig, manuallyChanged = false;
  let userPaused = media.matches, hovered = false, focused = false, inViewport = true, pointer = null, suppressClickUntil = 0;
  controls.hidden = false;
  root.classList.add('carousel-ready');
  const words = () => lang === 'uk' ? {
    of:'з',show:'Показати слайд',previous:'Попередній слайд',next:'Наступний слайд',pause:'Зупинити автоперемикання',play:'Увімкнути автоперемикання',paused:'Пауза',playing:'Авто',reduced:'Автоперемикання вимкнено налаштуванням зменшення руху'
  } : {of:'из',show:'Показать слайд',previous:'Предыдущий слайд',next:'Следующий слайд',pause:'Остановить автопереключение',play:'Включить автопереключение',paused:'Пауза',playing:'Авто',reduced:'Автопереключение отключено настройкой уменьшения движения'};
  function schedule() {
    clearTimeout(timer);
    const playing = !userPaused && !media.matches && !hovered && !focused && !document.hidden && inViewport && slides.length > 1;
    root.dataset.playing = String(playing);
    if (playing) timer = setTimeout(() => show(index + 1), intervalMs);
  }
  function render() {
    const labels = words();
    slides.forEach((slide,i) => {
      let delta = i - index;
      if (delta > slides.length / 2) delta -= slides.length;
      if (delta < -slides.length / 2) delta += slides.length;
      slide.hidden = false;
      slide.classList.toggle('is-active',i === index);
      slide.style.setProperty('--offset',String(delta));
      slide.inert = i !== index;
      slide.setAttribute('aria-hidden',String(i !== index));
      slide.setAttribute('aria-label',`${i+1} ${labels.of} ${slides.length}`);
      if (i === index) slide.querySelector('img').loading = 'eager';
    });
    Array.from(dots.children).forEach((dot,i) => {
      dot.setAttribute('aria-current',String(i===index));
      dot.setAttribute('aria-label',`${labels.show} ${i+1} ${labels.of} ${slides.length}`);
    });
    root.querySelector('[data-carousel-prev]').setAttribute('aria-label',labels.previous);
    root.querySelector('[data-carousel-next]').setAttribute('aria-label',labels.next);
    root.querySelector('.carousel-counter').textContent = `${String(index+1).padStart(2,'0')} / ${String(slides.length).padStart(2,'0')}`;
    playButton.disabled = media.matches || slides.length < 2;
    playButton.setAttribute('aria-label',media.matches ? labels.reduced : userPaused ? labels.play : labels.pause);
    playButton.setAttribute('aria-pressed',String(!userPaused && !media.matches));
    playButton.querySelector('span').textContent = media.matches || userPaused ? labels.paused : labels.playing;
    playButton.classList.toggle('is-paused',userPaused || media.matches);
    root.dataset.activeIndex = String(index);
    schedule();
  }
  function show(next, manual = false) {
    if (!slides.length) return;
    if (manual) manuallyChanged = true;
    const focusWasInSlide = slides[index]?.contains(document.activeElement);
    index = (next + slides.length) % slides.length;
    render();
    if (manual) {
      announcement.textContent = `${index+1} ${words().of} ${slides.length}. ${slides[index].querySelector('h2').textContent}`;
      if (focusWasInSlide) slides[index].querySelector('a').focus({preventScroll:true});
    }
  }
  root.querySelector('[data-carousel-prev]').addEventListener('click',() => show(index-1,true));
  root.querySelector('[data-carousel-next]').addEventListener('click',() => show(index+1,true));
  dots.addEventListener('click',event => {
    const dot = event.target.closest('[data-carousel-dot]');
    if (dot) show(Number(dot.dataset.carouselDot),true);
  });
  playButton.addEventListener('click',() => { userPaused = !userPaused; if (!userPaused) focused = false; render(); });
  root.addEventListener('pointerenter',event => { if(event.pointerType==='mouse') {hovered=true;schedule();} });
  root.addEventListener('pointerleave',() => {hovered=false;schedule();});
  root.addEventListener('focusin',() => {focused=true;schedule();});
  root.addEventListener('focusout',() => queueMicrotask(() => { focused=root.contains(document.activeElement);schedule(); }));
  root.addEventListener('keydown',event => {
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();show(index+(event.key==='ArrowRight'?1:-1),true);
  });
  stage.addEventListener('pointerdown',event => { if(event.pointerType==='touch') pointer={x:event.clientX,y:event.clientY}; });
  stage.addEventListener('pointercancel',() => {pointer=null;});
  stage.addEventListener('pointerup',event => {
    if (!pointer) return;
    const x=event.clientX-pointer.x,y=event.clientY-pointer.y;pointer=null;
    if(Math.abs(x)>45 && Math.abs(x)>Math.abs(y)*1.4) { suppressClickUntil=Date.now()+400;show(index+(x<0?1:-1),true); }
  });
  stage.addEventListener('click',event => {if(Date.now()<suppressClickUntil){event.preventDefault();event.stopPropagation();}},true);
  document.addEventListener('visibilitychange',schedule);
  media.addEventListener('change',() => {if(media.matches)userPaused=true;render();});
  window.addEventListener('pagehide',() => clearTimeout(timer));
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => { inViewport=entries[0].isIntersecting;schedule(); },{threshold:.25}).observe(root);
  function update(menu,nextLang='ru',config) {
    intervalMs=config?.intervalMs || PROMOTION_INTERVAL;
    const id = slides[index]?.dataset.slideId;
    lang = nextLang;
    const offers = promotionSlides(menu,lang,config);
    const nextSignature = JSON.stringify([intervalMs,offers]);
    if (signature === nextSignature) return;
    signature = nextSignature;
    const dotFocus = document.activeElement?.dataset?.carouselDot;
    const slideFocus = stage.contains(document.activeElement);
    stage.innerHTML = offers.map(slideMarkup).join('');
    slides = Array.from(stage.children);
    root.hidden = slides.length === 0;
    controls.hidden = slides.length < 2;
    index = config !== lastConfig && !manuallyChanged ? 0 : Math.max(0,offers.findIndex(offer=>offer.id===id));
    lastConfig = config;
    dots.innerHTML = slides.map((_,i)=>`<button type="button" data-carousel-dot="${i}" aria-label="${words().show} ${i+1}" class="carousel-dot"></button>`).join('');
    render();
    if (dotFocus !== undefined) dots.children[Math.min(Number(dotFocus),slides.length-1)]?.focus({preventScroll:true});
    else if (slideFocus && slides[index]) slides[index].querySelector('a').focus({preventScroll:true});
  }
  return { update };
}
