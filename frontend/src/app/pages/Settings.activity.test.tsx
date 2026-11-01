// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';import {MemoryRouter} from 'react-router';import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({get:vi.fn(),save:vi.fn()}));
vi.mock('../lib/api',()=>({fetchActivityPrivacy:mocks.get,saveActivityPrivacy:mocks.save,invalidate:vi.fn(),logout:vi.fn()}));
vi.mock('../components/AppInstallation',()=>({AppInstallation:()=>null}));
vi.mock('../lib/session',()=>({getUsername:()=> 'Reader',isAdmin:()=>false,clearSession:vi.fn()}));
vi.mock('../lib/readerChoice',()=>({getSavedReaderMode:()=>null,setSavedReaderMode:vi.fn()}));
vi.mock('../lib/settings',()=>({useSettings:()=>[{theme:'claro',reduceMotion:false,soundsOn:false,notificationsOn:false,smoothZoom:false},vi.fn()],desktopPermission:()=> 'default',NOTIFICATION_LABELS:{},requestDesktopPermission:vi.fn()}));
import {Settings} from './Settings';
afterEach(cleanup);beforeEach(()=>{vi.clearAllMocks();mocks.get.mockResolvedValue({shareRecentActivity:false});mocks.save.mockResolvedValue({shareRecentActivity:true});});
it('loads the account opt-in and updates it only after server confirmation',async()=>{
 let resolve!:(value:any)=>void;mocks.save.mockImplementation(()=>new Promise(done=>{resolve=done;}));
 render(<MemoryRouter><Settings/></MemoryRouter>);const toggle=screen.getByRole('switch',{name:'Exibir atividade recente para amigos próximos'});
 await waitFor(()=>expect(toggle).toBeEnabled());expect(toggle).toHaveAttribute('aria-checked','false');fireEvent.click(toggle);
 expect(mocks.save).toHaveBeenCalledWith(true);expect(toggle).toHaveAttribute('aria-checked','false');expect(toggle).toBeDisabled();
 resolve({shareRecentActivity:true});await waitFor(()=>expect(toggle).toHaveAttribute('aria-checked','true'));
});
it('preserves the previous opt-in on an error and offers retry',async()=>{
 mocks.save.mockRejectedValue(new Error('Servidor indisponível'));render(<MemoryRouter><Settings/></MemoryRouter>);
 const toggle=screen.getByRole('switch',{name:'Exibir atividade recente para amigos próximos'});await waitFor(()=>expect(toggle).toBeEnabled());fireEvent.click(toggle);
 expect(await screen.findByRole('alert')).toHaveTextContent('Servidor indisponível');expect(toggle).toHaveAttribute('aria-checked','false');fireEvent.click(screen.getByRole('button',{name:'Tentar novamente'}));await waitFor(()=>expect(toggle).toBeEnabled());
});
