// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {MemoryRouter,Link,useLocation} from 'react-router';
import {afterEach,expect,it,vi} from 'vitest';
import {PublicProfileLayout} from './PublicProfileLayout';
afterEach(cleanup);
function Location(){const location=useLocation();return <output aria-label="Destino">{location.pathname+location.search}</output>;}
it.each(['Seguir','Conversar','Livro','Estante','Instagram'])('sends anonymous %s actions to login before executing them',name=>{
 const mutate=vi.fn();render(<MemoryRouter initialEntries={['/user/Ana']}><PublicProfileLayout><button onClick={mutate}>Seguir</button><Link to="/chat/Ana">Conversar</Link><Link to="/book/one">Livro</Link><button onClick={mutate}>Estante</button><a href="https://instagram.com/ana">Instagram</a></PublicProfileLayout><Location/></MemoryRouter>);
 fireEvent.click(screen.getByText(name));expect(screen.getByLabelText('Destino').textContent).toBe('/user/Ana?auth=login');expect(mutate).not.toHaveBeenCalled();
});
it('exposes Logar in place of account actions and keeps the original profile destination',()=>{
 render(<MemoryRouter initialEntries={['/user/Ana%20Leitora?tab=estante']}><PublicProfileLayout><h1>Ana</h1></PublicProfileLayout><Location/></MemoryRouter>);
 fireEvent.click(screen.getByRole('link',{name:'Logar'}));expect(screen.getByLabelText('Destino').textContent).toBe('/user/Ana%20Leitora?tab=estante&auth=login');
});
