import { Columns2, Hand, MoveHorizontal, SlidersHorizontal, Eye } from "lucide-react";
import { Modal } from "./Ui";
export function ReaderTutorial({ onDone }: { onDone:()=>void }) {
  return <Modal open title="Seu momento de leitura" description="Conheça os gestos. Este guia aparece uma única vez na sua conta." onClose={onDone} size="lg" footer={<button className="mb-btn mb-btn-primary" onClick={onDone}>Entendi, começar a ler</button>}>
    <div className="mb-reader-tutorial">
      <p><Eye/><span><strong>Só você e as páginas</strong>Toque uma vez na página para revelar o botão de controles. Toque nesse botão para mostrar ou esconder todas as informações.</span></p>
      <p><MoveHorizontal/><span><strong>Deslize para virar</strong>Nos modos de uma ou duas páginas, arraste para a esquerda para avançar e para a direita para voltar. No PDF, mantenha o cadeado fechado para virar por arraste e abra-o para mover a folha. Um toque simples nas laterais não vira a página. As setas continuam disponíveis com os controles ocultos.</span></p>
      <p><Hand/><span><strong>Três dedos por 3 segundos</strong>Mantenha três dedos parados na página para abrir o ajuste personalizado. Soltar ou mover os dedos antes cancela o gesto.</span></p>
      <p><Columns2/><span><strong>Um encaixe para cada modo</strong>No ajuste, posicione arrastando e dê zoom com dois dedos. Confirme primeiro uma página e depois duas páginas. Os presets ficam salvos para sua conta neste aparelho.</span></p>
      <p><SlidersHorizontal/><span><strong>Personalize quando quiser</strong>Nos controles, abra Ajustes de leitura para trocar o modo, tema, brilho e tamanho. No PDF, a opção de páginas automáticas usa uma página em pé e duas com a tela deitada no celular ou tablet. Também pode abrir o ajuste dos presets ou consultar este guia novamente por lá. No modo rolagem, passe o dedo para cima ou para baixo.</span></p>
    </div>
  </Modal>;
}
