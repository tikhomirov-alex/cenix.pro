import puppeteer from "puppeteer";
import axios from "axios";
import * as fs from 'fs';

(async () => {
    // eslint-disable-next-line no-undef
    const [, , categoryLink] = process.argv; //https://www.vprok.ru/catalog/7382/pomidory-i-ovoschnye-nabory

    if (!categoryLink) {
        console.error('Usage: node puppeteer.js <categoryLink>');
        // eslint-disable-next-line no-undef
        process.exit(1);
    }

    const fullLink = `${categoryLink}?sort=popularity_desc&page=1`;

    // Извлекаем ID категории из ссылки
    const categoryIdMatch = categoryLink.match(/catalog\/(\d+)\//);
    if (!categoryIdMatch) {
        console.error('Invalid category link format.');
        // eslint-disable-next-line no-undef
        process.exit(1);
    }

    const categoryId = categoryIdMatch[1]; // Получаем ID категории
    const apiUrl = `https://www.vprok.ru/web/api/v1/catalog/category/${categoryId}?sort=popularity_desc&limit=30&page=1`;

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Переходим на страницу
    await page.goto(categoryLink, {
        waitUntil: 'domcontentloaded'
    });

    const url = new URL(categoryLink);
    const relativePath = url.pathname;
    const payload = {
        noRedirect: true,
        url: relativePath
    }

    const cookies = await browser.cookies();
    const cookie = cookies.map((ck) => `${ck.name}=${ck.value}`).join('; ');

    const response = await axios.post(apiUrl, JSON.stringify(payload), {
        xsrfCookieName: 'XSRF-TOKEN',
        xsrfHeaderName: 'X-Xsrf-Token',
        withXSRFToken: true,
        headers: {
            'accept': 'application/json, text/plain, */*',
            'cookie': cookie,
            'origin': 'https://www.vprok.ru',
            'referer': `${fullLink.slice(0, -1)}2`,
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 YaBrowser/24.12.0.0 Safari/537.36',
        }
    });

    const products = response.data.products;

    let output = '';
    for (const product of products) {
        output += `
            Название товара: ${product.name}
            Ссылка на изображение: ${product.images[0].url}
            Рейтинг: ${product.rating}
            Количество отзывов: ${product.reviews}
            Цена: ${product.price}
            Акционная цена: ${product.discount}
            Цена до акции: ${product.oldPrice}
            Размер скидки: ${product.discountPercent}
        `
    }

    fs.writeFileSync('products-api.txt', output);

    await browser.close();

})();
