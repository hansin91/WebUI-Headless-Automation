import { Builder, By, until } from "selenium-webdriver";
import { Select } from "selenium-webdriver/lib/select.js";
import assert from "assert";
import chrome from "selenium-webdriver/chrome.js";
import edge from "selenium-webdriver/edge.js";

const browsers = ["chrome", "MicrosoftEdge"];
const URL = "https://www.saucedemo.com";
const USERNAME = "standard_user";
const PASSWORD = "secret_sauce";
const SORT_PRICE_BY_ASC = "Price (low to high)";
const SORT_PRICE_BY_DESC = "Price (high to low)";
let driver = await new Builder();

const setupInitialDriver = async (browser) => {
  let options = null;
  if (browser === "chrome") {
    options = new chrome.Options();
    options.addArguments("--incognito");
    driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
  } else {
    options = new edge.Options();
    options.addArguments("--inprivate");
    driver = await new Builder().forBrowser("MicrosoftEdge").setEdgeOptions(options).build();
  }
};

const login = async () => {
  const inputUsername = await driver.findElement(By.xpath('//input[@id="user-name"]'));
  const inputPassword = await driver.findElement(By.xpath('//input[@id="password"]'));
  const loginButton = await driver.findElement(By.xpath('//input[@id="login-button"]'));
  await inputUsername.sendKeys(USERNAME);
  await inputPassword.sendKeys(PASSWORD);
  await loginButton.click();
};

const waitUntilSortOptionsLoaded = async () => {
  const sortContainer = await driver.wait(
    until.elementLocated(By.xpath('//*[@class="select_container"]')),
    1000,
  );

  await driver.wait(
    until.elementIsVisible(sortContainer),
    500,
    "Sort container should be displayed",
  );
};

const waitUntilProductsContainerLoaded = async () => {
  const inventoryContainer = await driver.wait(
    until.elementLocated(By.xpath('//div[@id="inventory_container"]')),
    1000,
  );
  await driver.wait(
    until.elementIsVisible(inventoryContainer),
    500,
    "Products container should be displayed",
  );
};

const fetchPricesFromInventoryItems = async (inventoryItems) => {
  const prices = [];
  for (const item of inventoryItems) {
    const descriptionItem = await item.findElement(By.className("inventory_item_description"));
    const priceBar = await descriptionItem
      .findElement(By.className("pricebar"))
      .findElement(By.className("inventory_item_price"));
    const price = Number((await priceBar.getText()).replace("$", ""));
    prices.push(price);
  }
  return prices;
};

const chooseSortOption = async (sort) => {
  await waitUntilSortOptionsLoaded();
  const dropdownSort = await driver.findElement(
    By.xpath('//select[@class="product_sort_container"]'),
  );
  await dropdownSort.click();
  let option = await driver.findElement(By.xpath(`//option[text()="${sort}"]`));
  await option.click();

  await driver.wait(
    until.elementTextIs(driver.findElement(By.xpath('//*[@class="active_option"]')), `${sort}`),
    3000,
  );

  const selectedOptionText = await driver
    .findElement(By.xpath('//*[@class="active_option"]'))
    .getText();
  assert.strictEqual(selectedOptionText, sort);
};

const getInventoryItems = async () => {
  await waitUntilProductsContainerLoaded();
  const inventoryList = await driver.findElement(By.className("inventory_list"));
  const inventoryItems = await inventoryList.findElements(By.className("inventory_item"));
  return inventoryItems;
};

const findSortedProducts = async (sort) => {
  const inventoryItems = await getInventoryItems();
  const prices = await fetchPricesFromInventoryItems(inventoryItems);
  const sortedPrices = [...prices].sort((a, b) => (sort === SORT_PRICE_BY_ASC ? a - b : b - a));
  assert.deepStrictEqual(
    prices,
    sortedPrices,
    sort === SORT_PRICE_BY_ASC
      ? "Products are not sorted by price low to high"
      : "Products are not sorted by price high to low",
  );
};

browsers.forEach((browser) => {
  describe(`Saucedemo on ${browser} Test`, async () => {
    before(async () => {
      await setupInitialDriver(browser);
      await driver.get(URL);
      await login();
    });

    it("Login successfully", async () => {
      // check sidebar and logout button
      const sidebar = await driver.wait(
        until.elementLocated(By.xpath('//div[@class="bm-menu-wrap"]')),
        1000,
      );
      await driver.wait(until.elementIsVisible(sidebar), 5000, "Sidebar should be displayed");
      const logoutAnchor = await driver.findElement(By.xpath('//a[@id="logout_sidebar_link"]'));
      const logoutText = await driver.executeScript(
        "return arguments[0].textContent;",
        logoutAnchor,
      );
      assert.strictEqual(logoutText, "Logout", "Logout button should be displayed");

      // check sort container should be displayed
      await waitUntilSortOptionsLoaded();
      const selectedOptionText = await driver
        .findElement(By.xpath('//*[@class="active_option"]'))
        .getText();
      const firstOption = await driver.findElement(
        By.xpath('//select[@class="product_sort_container"]/option[1]'),
      );
      const firstOptionText = await firstOption.getText();
      assert.strictEqual(selectedOptionText, firstOptionText);

      // check product displayed
      const inventoryItems = await getInventoryItems();
      assert.strictEqual(inventoryItems.length, 6);
    });

    it("Sort products by price (low to high)", async () => {
      await chooseSortOption(SORT_PRICE_BY_ASC);
      await findSortedProducts(SORT_PRICE_BY_ASC);
    });

    it("Sort products by price (high to low)", async () => {
      await chooseSortOption(SORT_PRICE_BY_DESC);
      await findSortedProducts(SORT_PRICE_BY_DESC);
    });

    after(async () => {
      await driver.quit();
    });
  });
});
