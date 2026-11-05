import {DEFAULT_SITE_SETTINGS,arrangeSections} from './site-settings.js?v=5.0.0';
export function applyAppearance(doc,settings,language){
 doc.documentElement.dataset.desktopColumns=String(settings.desktopColumns);doc.documentElement.dataset.mobileColumns=String(settings.mobileColumns);
 doc.querySelectorAll('.logo strong,.footer-logo').forEach(el=>{if(el.textContent.trim()!==settings.storeName)el.textContent=settings.storeName;});
 const slogan=settings[language==='en'?'sloganEn':'sloganAr'];doc.querySelector('.logo small')?.replaceChildren(doc.createTextNode(slogan));
 const footer=doc.querySelector('.footer-grid>div:first-child p');if(footer)footer.textContent=slogan;
}
export function applyHomeLayout(main,settings,language){
 const hero=main.querySelector('.hero');if(hero){const title=language==='en'?'heroTitleEn':'heroTitleAr',text=language==='en'?'heroTextEn':'heroTextAr';if(settings[title]!==DEFAULT_SITE_SETTINGS[title])hero.querySelector('h1').textContent=settings[title];if(settings[text]!==DEFAULT_SITE_SETTINGS[text])hero.querySelector('.hero-content>p').textContent=settings[text];}
 const definitions={hero:'.hero',benefits:'.benefits',categories:'.cat-grid',offers:'.featured-offers',picks:'.new-products-head',moments:'.campaign-grid',korean:'a.text-link[href="#/shop?collection=korean-care"]',callout:'.callout',deals:'a.text-link[href="#/shop?max=5000"]',reviews:'#homeReviews',trust:'.trust-list'};
 for(const[id,selector]of Object.entries(definitions)){const found=main.querySelector(selector);if(found)(id==='benefits'?found:found.closest('section')).dataset.storeSection=id;}
 arrangeSections(main,settings.homeSections,Object.fromEntries(settings.homeSections.map(x=>[x.id,`[data-store-section="${x.id}"]`])));
}
export function applyProductSections(main,settings){
 const article=main.querySelector('.product-story');if(!article)return;
 const selectors={hero:'.story-hero',navigation:'.story-section-nav',about:'#storyTexture',fit:'#storyFit',usage:'#storyHow',media:'#storyVideos',reviews:'#productReviews',faq:'#storyFaq',recommendations:'#detailRecommendations',last:'.story-last-cta'};
 arrangeSections(article,settings.productSections,selectors);const sticky=article.querySelector('[data-story-sticky]');if(sticky)article.append(sticky);
 article.querySelectorAll('[data-story-scroll]').forEach(button=>{const target=article.querySelector('#'+button.dataset.storyScroll);if(target?.hidden){button.hidden=true;button.dataset.settingsHidden='';}});
 const jump=article.querySelector('[data-aqua-jump]');if(jump&&article.querySelector('#storyVideos')?.hidden){jump.hidden=true;jump.dataset.settingsHidden='';}
}
