import puppeteer from 'puppeteer';
import fs from 'fs';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scroll(page, direction) {
    await page.evaluate(async (dir) => {
        const distance = dir === 'down' ? 100 : -100;
        const scrollHeight = document.body.scrollHeight;
        while (true) {
            window.scrollBy(0, distance);
            if (dir === 'down' && window.innerHeight + window.scrollY >= scrollHeight) break;
            if (dir === 'up' && window.scrollY === 0) break;
            await new Promise(r => setTimeout(r, 100));
        }
    }, direction);
}

(async () => {
    // eslint-disable-next-line no-undef
    const [, , url, region] = process.argv;

    if (!url || !region) {
        console.error('Usage: node puppeteer.js <url> <region>');
        // eslint-disable-next-line no-undef
        process.exit(1);
    }

    const browser = await puppeteer.launch({
        headless: true,
    });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1280, height: 1024 });

    await page.goto(url, { waitUntil: 'networkidle2' });

    // Закрытие модального окна
    await page.waitForSelector('[class*="Tooltip_closeIcon"]', { timeout: 10000 });
    await page.click('[class*="Tooltip_closeIcon"]');

    // Нажатие на кнопку "Согласен" после закрытия окна
    await page.waitForSelector('[class*="CookiesAlert_agreeButton"]', { timeout: 10000 });
    const agreeButton = await page.$('[class*="CookiesAlert_agreeButton"] button');
    if (agreeButton) {
        await agreeButton.click();
    }
    // Открытие окна выбора региона
    await page.waitForSelector('[class*="UiHeaderHorizontalBase_region"]', { timeout: 10000 });
    await page.click('[class*="UiHeaderHorizontalBase_region"]');

    // Выбор региона из модального окна
    await page.waitForSelector('[class*="UiRegionListBase_item"]', { timeout: 10000 });
    const regions = await page.$$('[class*="UiRegionListBase_item"]');

    for (const regionElement of regions) {
        const text = await page.evaluate(el => el.innerText, regionElement);
        if (text.includes(region)) {
            await regionElement.click();
            break;
        }
    }

    // Ожидание закрытия окна выбора региона и загрузки региона
    await page.waitForSelector('[class*="UiRegionListBase_item"]', { hidden: true, timeout: 10000 });
    await page.waitForSelector('[class*="UiHeaderHorizontalBase_region"]', { timeout: 10000 });

    //Прогрузка всей страницы
    await scroll(page, 'down');
    await delay(2000);

    await page.waitForSelector('footer', { visible: true, timeout: 10000 });
    await scroll(page, 'up');
    await delay(2000);

    await page.screenshot({ path: 'screenshot.jpg', fullPage: true, type: 'png' });

    await Promise.all([
        page.waitForSelector('[class*="PriceInfo_root"]', { timeout: 10000 }),
        page.waitForSelector('[class*="ActionsRow_reviewsWrapper"]', { timeout: 10000 }),
    ]);

    // Извлечение данных
    const data = await page.evaluate(() => {
        // Извлечение рейтинга
        const ratingElement = document.querySelector('[class*="ActionsRow_stars"]');
        const ratingText = ratingElement ? ratingElement.getAttribute('title') : null;
        const rating = ratingText ? parseFloat(ratingText.split(': ')[1]) : null;

        // Извлечение количества отзывов
        const reviewCountElement = document.querySelector('[class*="ActionsRow_reviews_"]');
        const reviewCountText = reviewCountElement ? reviewCountElement.textContent.trim() : null;
        const reviewCount = reviewCountText ? parseInt(reviewCountText) : null;

        // Извлечение цен
        const priceElement = document.querySelector('[class*="ProductPage_buy"] [class*="Price_role_discount"]');
        const priceOldElement = document.querySelector('[class*="ProductPage_buy"] [class*="Price_role_old"]');

        let price = priceElement ? priceElement.innerText.replace(/[^0-9]/g, '').trim() : null;
        const priceOld = priceOldElement ? priceOldElement.innerText.replace(/[^0-9]/g, '').trim() : null;

        // Если нет скидочной цены, проверяем на обычную цену
        if (!price) {
            const priceRegularElement = document.querySelector('[class*="ProductPage_buy"] [class*="Price_role_regular"]');
            price = priceRegularElement ? priceRegularElement.innerText.replace(/[^0-9]/g, '').trim() : null;
        }

        // Функция для парсинга цены
        const parsePrice = (priceString) => {
            if (!priceString) return null;
            return parseFloat(priceString.replace(',', '.'));
        };

        return {
            price: parsePrice(price),
            priceOld: parsePrice(priceOld),
            rating: rating,
            reviewCount: reviewCount,
        };
    });

    // Запись данных в файл
    const output = `
            price = ${data.price !== null ? data.price : 'N/A'}
            priceOld = ${data.priceOld !== null ? data.priceOld : 'N/A'}
            rating = ${data.rating !== null ? data.rating : 'N/A'}
            reviewCount = ${data.reviewCount !== null ? data.reviewCount : 'N/A'}`
        .trim();

    fs.writeFileSync('product.txt', output);

    await browser.close();
})();
