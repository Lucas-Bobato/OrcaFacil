import { expect, test, type Page } from '@playwright/test';

/**
 * Integração ponta a ponta: interface → API → SQLite.
 * Os testes rodam em sequência e compartilham a mesma conta.
 */
test.describe.configure({ mode: 'serial' });

const conta = { email: `e2e-${Date.now()}@teste.com`, senha: 'senha1234' };

async function entrar(page: Page) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(conta.email);
  await page.getByLabel('Senha').fill(conta.senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function adicionarItem(page: Page, descricao: string, qtd: string, unidade: string, valorDigitos: string) {
  await page.getByLabel(/Descrição do serviço/).fill(descricao);
  await page.getByLabel(/Qtd/).fill(qtd);
  await page.getByLabel('Unid.').selectOption(unidade);
  await page.getByLabel(/Valor unit/).pressSequentially(valorDigitos);
  await page.getByRole('button', { name: /Adicionar item/ }).click();
  await expect(page.getByText(new RegExp(`\\d+\\. ${descricao}$`))).toBeVisible();
}

test('US01–US07: cadastro, perfil, orçamento com 3 itens, PDF e download', async ({ page }) => {
  // Conta
  await page.goto('/cadastrar');
  await page.getByLabel(/^E-mail/).fill(conta.email);
  await page.getByLabel(/^Senha/).fill(conta.senha);
  await page.getByLabel(/Repita a senha/).fill(conta.senha);
  await page.getByRole('button', { name: 'Criar conta' }).click();

  // CA01.1 — primeiro acesso leva ao perfil; CA01.3 — validação
  await expect(page.getByRole('heading', { name: 'Configure seu perfil' })).toBeVisible();
  await page.getByLabel(/Telefone \/ WhatsApp/).fill('11987654321');
  await page.getByRole('button', { name: /Salvar e começar/ }).click();
  await expect(page.getByText('Informe seu nome ou o nome da empresa')).toBeVisible();
  await page.getByLabel('Seu nome').fill('João da Silva');
  await page.getByLabel('Nome da empresa').fill('João Pinturas');
  await page.getByRole('button', { name: /Salvar e começar/ }).click();
  await expect(page.getByText('Perfil salvo')).toBeVisible(); // CA01.2
  await expect(page.getByText('Nenhum orçamento ainda')).toBeVisible();

  // 01 Preencher (US02)
  await page.getByRole('button', { name: /Novo orçamento/ }).click();
  await expect(page.getByText(/ORC-\d{4}-0001/)).toBeVisible(); // RN07
  await expect(page.getByText('João Pinturas · (11) 98765-4321')).toBeVisible(); // CA01.4
  await page.getByRole('button', { name: /Próximo/ }).click();
  await expect(page.getByText('Informe o nome do cliente')).toBeVisible(); // CA02.2
  await page.getByLabel(/Nome do cliente/).fill('Maria Silva');
  await page.getByLabel('Telefone').fill('1191234');
  await page.getByRole('button', { name: /Próximo/ }).click();
  await expect(page.getByText('Telefone inválido')).toBeVisible(); // CA02.3
  await page.getByLabel('Telefone').fill('11912345678');
  await page.getByLabel('Endereço do serviço').fill('Rua das Flores, 100 - Apto 12');
  await page.getByRole('button', { name: /Próximo/ }).click();

  // 02 Detalhar (US03, US04)
  await expect(page.getByRole('heading', { name: 'Serviços' })).toBeVisible();
  await adicionarItem(page, 'Pintura de parede', '20', 'M2', '2500');
  await expect(page.getByLabel('Total do orçamento')).toHaveText('R$ 500,00'); // CA03.1
  await adicionarItem(page, 'Massa corrida', '1', 'VB', '30000');
  await expect(page.getByLabel('Total do orçamento')).toHaveText('R$ 800,00'); // CA03.2
  await adicionarItem(page, 'Lixamento', '2,5', 'H', '4000');
  await expect(page.getByLabel('Total do orçamento')).toHaveText('R$ 900,00');

  // CA04.1 — editar quantidade
  await page.getByRole('button', { name: 'Editar Pintura de parede' }).click();
  await page.getByLabel(/Qtd/).fill('30');
  await page.getByRole('button', { name: /Salvar item/ }).click();
  await expect(page.getByLabel('Total do orçamento')).toHaveText('R$ 1.150,00');
  await page.getByRole('button', { name: /Próximo/ }).click();

  // 03 Revisar (US05)
  await expect(page.getByRole('button', { name: /Gerar PDF/ })).toBeDisabled(); // CA06.2
  await expect(page.getByLabel('Validade (dias)')).toHaveValue('15'); // CA05.3
  await page.getByLabel(/Prazo \(dias\)/).fill('400');
  await expect(page.getByText('Informe um prazo entre 1 e 365 dias').first()).toBeVisible(); // CA05.2
  await page.getByLabel(/Prazo \(dias\)/).fill('2');
  await page.getByLabel('Condições de pagamento').fill('50% no início e 50% na conclusão.');
  await page.getByLabel('Observações').fill('Materiais por conta do cliente.');
  await expect(page.getByText('Rascunho salvo automaticamente na sua conta.')).toBeVisible();
  await expect(page.getByText('Pintura de parede · Massa corrida · Lixamento')).toBeVisible(); // CA05.4

  // 04 Gerar PDF (US06) — RNF01: até 2 s
  const inicio = Date.now();
  await page.getByRole('button', { name: /Gerar PDF/ }).click();
  await expect(page.getByText('PDF gerado')).toBeVisible();
  expect(Date.now() - inicio).toBeLessThan(2000);
  await expect(page.getByText(/Orcamento_ORC-\d{4}-0001_Maria-Silva\.pdf/)).toBeVisible();

  // CA07.1 — download com o nome definido em RN12
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Baixar/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^Orcamento_ORC-\d{4}-0001_Maria-Silva\.pdf$/);

  // CA08.1 — volta para a lista com status Emitido e total
  await page.getByRole('link', { name: 'Voltar aos orçamentos' }).click();
  const cartao = page.getByRole('listitem').filter({ hasText: 'Maria Silva' });
  await expect(cartao.getByText('Emitido')).toBeVisible();
  await expect(cartao.getByText('R$ 1.150,00')).toBeVisible();
});

test('dados disponíveis em outro navegador após login', async ({ browser }) => {
  // Novo contexto = outro navegador/aparelho, sem nada salvo localmente
  const outroNavegador = await browser.newContext();
  const page = await outroNavegador.newPage();
  await entrar(page);
  await expect(page.getByRole('heading', { name: 'Meus orçamentos' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Maria Silva' })).toBeVisible();
  await outroNavegador.close();
});

test('CA08.3 / CA08.4 / CA08.2 / CA08.5: rascunho, duplicar, busca e exclusão', async ({ page }) => {
  await entrar(page);
  await expect(page.getByRole('heading', { name: 'Meus orçamentos' })).toBeVisible();

  // CA08.4 — duplicar mantém itens e deixa o cliente em branco
  await page.getByRole('button', { name: /Ações do orçamento ORC-\d{4}-0001/ }).click();
  await page.getByRole('button', { name: 'Duplicar como novo' }).click();
  await expect(page.getByText(/^ORC-\d{4}-0002$/)).toBeVisible();
  await expect(page.getByLabel(/Nome do cliente/)).toHaveValue('');
  await page.getByLabel(/Nome do cliente/).fill('Carlos Souza');
  await page.getByRole('button', { name: /Próximo/ }).click();
  await expect(page.getByText('3. Lixamento')).toBeVisible();

  // CA08.3 — recarregar e reabrir continua na etapa em que parou
  await page.goto('/');
  const rascunho = page.getByRole('listitem').filter({ hasText: 'Carlos Souza' });
  await expect(rascunho.getByText('Rascunho')).toBeVisible();
  await rascunho.getByRole('button', { name: /Abrir/ }).click();
  await expect(page.getByRole('heading', { name: 'Serviços' })).toBeVisible();

  // CA08.2 — busca por cliente
  await page.goto('/');
  await page.getByLabel('Buscar por cliente').fill('carlos');
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByRole('listitem').getByText('Carlos Souza')).toBeVisible();

  // CA08.5 — excluir com confirmação
  await page.getByRole('button', { name: /Ações do orçamento ORC-\d{4}-0002/ }).click();
  await page.getByRole('button', { name: 'Excluir' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByText('Orçamento excluído')).toBeVisible();
  await expect(page.getByText('Nenhum orçamento para “carlos”.')).toBeVisible();
});

test('RNF12: layout em 360 px sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await entrar(page);
  await expect(page.getByRole('heading', { name: 'Meus orçamentos' })).toBeVisible();
  for (const rota of ['/', '/perfil']) {
    await page.goto(rota);
    await page.waitForLoadState('networkidle');
    const larguras = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    expect(larguras[0]).toBeLessThanOrEqual(larguras[1]);
  }
});

test('Segurança: dentro de um iframe a aplicação não abre', async ({ page, baseURL }) => {
  await page.setContent(`<iframe src="${baseURL}/privacidade" width="400" height="400"></iframe>`);
  await expect(page.frameLocator('iframe').getByText('não pode ser aberto dentro de outra página')).toBeVisible();
  await expect(page.frameLocator('iframe').getByRole('button', { name: 'Apagar todos os meus dados' })).toHaveCount(0);
});

test('Segurança: sair em uma aba encerra a outra e revoga o token no servidor', async ({ page, context, request, baseURL }) => {
  await entrar(page);
  await expect(page.getByRole('heading', { name: 'Meus orçamentos' })).toBeVisible();
  const token = await page.evaluate(() => localStorage.getItem('orcafacil.token'));

  const outraAba = await context.newPage();
  await outraAba.goto('/');
  await expect(outraAba.getByRole('heading', { name: 'Meus orçamentos' })).toBeVisible();

  await page.goto('/perfil');
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await expect(outraAba.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await outraAba.close();

  await expect
    .poll(async () => (await request.get(`${baseURL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).status())
    .toBe(401);
});

test('RNF21: apagar todos os dados encerra a conta', async ({ page }) => {
  await entrar(page);
  await expect(page.getByRole('heading', { name: 'Meus orçamentos' })).toBeVisible();
  await page.goto('/privacidade');
  await page.getByRole('button', { name: 'Apagar todos os meus dados' }).click();
  await page.getByRole('dialog').getByLabel('Sua senha, para confirmar').fill(conta.senha);
  await page.getByRole('dialog').getByRole('button', { name: 'Apagar tudo' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  await entrar(page);
  await expect(page.getByText('E-mail ou senha incorretos')).toBeVisible();
});
