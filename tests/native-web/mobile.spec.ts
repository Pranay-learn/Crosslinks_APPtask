import {test,expect,type Page} from '@playwright/test';
async function login(page:Page,admin=false){await page.goto('./');await page.getByRole('button',{name:admin?'Explore admin demo':'Enter student demo',exact:true}).click();await expect(page.getByRole('button',{name:'Create a post',exact:true})).toBeVisible();}
async function tab(page:Page,name:string){await page.getByRole('tab',{name:new RegExp(name)}).click();}
test('Expo app supports discussions, replies and profile bookmarks',async({page})=>{
 await login(page);await tab(page,'Discussions');await page.getByRole('button',{name:'Start a discussion',exact:true}).click();
 await page.getByLabel('Title',{exact:true}).fill('Native web study group');await page.getByLabel('Your message',{exact:true}).fill('Let us work on graphs together at the library.');
 await page.getByRole('button',{name:'Publish post',exact:true}).click();await page.getByRole('button',{name:'Open discussion Native web study group',exact:true}).click();
 await page.getByLabel('Write a reply',{exact:true}).fill('Count me in!');await page.getByRole('button',{name:'Send reply',exact:true}).click();await expect(page.getByText('Count me in!',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Close Campus conversation',exact:true}).click();
 const card=page.getByRole('button',{name:'Open discussion Native web study group',exact:true}).locator('..');
 await card.getByRole('button',{name:'Bookmark',exact:true}).click();await tab(page,'Profile');await page.getByRole('button',{name:'Filter Bookmarks',exact:true}).click();await expect(page.getByRole('button',{name:'Native web study group',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Admin dashboard',exact:true})).toHaveCount(0);
});
test('Expo timetable survives closing and reopening a page offline',async({page,context})=>{
 await login(page);await tab(page,'Timetable');await page.getByRole('button',{name:'Filter Mon',exact:true}).click();await expect(page.getByText(/Downloaded • Last sync/)).toBeVisible();
 const subjects=await page.getByText(/Design & Analysis of Algorithms/).allTextContents();expect(subjects.length).toBeGreaterThan(0);
 await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.controller!==null)).toBe(true);
 await context.setOffline(true);await page.close();const reopened=await context.newPage();await reopened.goto('./');await tab(reopened,'Timetable');await reopened.getByRole('button',{name:'Filter Mon',exact:true}).click();await expect(reopened.getByText(/Offline • Last sync/)).toBeVisible();await expect(reopened.getByText(/Design & Analysis of Algorithms/).first()).toBeVisible();
 await context.setOffline(false);await expect(reopened.getByRole('button',{name:'Refresh timetable',exact:true})).toBeEnabled();await reopened.getByRole('button',{name:'Refresh timetable',exact:true}).click();await expect(reopened.getByText(/Downloaded • Last sync/)).toBeVisible();
});
test('Expo demo admin can publish a notice visible to the student role',async({page})=>{
 await login(page,true);await tab(page,'Profile');await page.getByRole('button',{name:'Admin dashboard',exact:true}).click();await page.getByRole('button',{name:'New announcement',exact:true}).click();
 await page.getByLabel('Title',{exact:true}).fill('Native workshop announcement');await page.getByLabel('Your message',{exact:true}).fill('A working sample announcement created in the native UI.');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();await tab(page,'Announcements');await expect(page.getByText('Native workshop announcement',{exact:true})).toBeVisible();
});
