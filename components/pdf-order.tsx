import { Pedido, Cliente, Vendedor } from '@/lib/types';

interface PDFOrderProps {
  pedido: Pedido;
  cliente: Cliente;
  vendedor?: Vendedor;
}

export function PDFOrder({ pedido, cliente, vendedor }: PDFOrderProps) {
  const dataEmissao = new Date(pedido.dataEmissao || pedido.criadoEm).toLocaleDateString('pt-BR');
  const dataEntrega = new Date(pedido.dataEntrega || pedido.prazoEntrega).toLocaleDateString('pt-BR');
  const valorTotal = pedido.itens.reduce((sum, item) => sum + item.precoUnitario * item.quantidade, 0);

  return (
    <div id="pdf-content" className="w-full p-8 bg-white text-black" style={{ minHeight: '297mm' }}>
      {/* Header */}
      <div className="border-b-2 border-gray-300 pb-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-blue-900">PRIMARDI</h1>
            <p className="text-sm text-gray-600">Gestão Comercial de Produtos</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-gray-700">PEDIDO</h2>
            <p className="text-lg font-semibold text-blue-900">#{pedido.id}</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600 font-semibold">Data de Emissão</p>
            <p className="text-gray-900">{dataEmissao}</p>
          </div>
          <div>
            <p className="text-gray-600 font-semibold">Data de Entrega Prevista</p>
            <p className="text-gray-900">{dataEntrega}</p>
          </div>
          <div>
            <p className="text-gray-600 font-semibold">Status</p>
            <p className="text-gray-900 font-medium capitalize">{pedido.status}</p>
          </div>
          <div>
            <p className="text-gray-600 font-semibold">Prioridade</p>
            <p className="text-gray-900 font-medium capitalize">{pedido.prioridade || 'Normal'}</p>
          </div>
        </div>
      </div>

      {/* Cliente Info */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="font-bold text-gray-700 mb-3 border-b border-gray-300 pb-2">DADOS DO CLIENTE</h3>
          <p className="text-sm mb-1">
            <span className="font-semibold text-gray-600">Empresa:</span>
            <span className="ml-2 text-gray-900">{cliente.razaoSocial}</span>
          </p>
          <p className="text-sm mb-1">
            <span className="font-semibold text-gray-600">Contato:</span>
            <span className="ml-2 text-gray-900">-</span>
          </p>
          <p className="text-sm mb-1">
            <span className="font-semibold text-gray-600">Email:</span>
            <span className="ml-2 text-gray-900">-</span>
          </p>
          <p className="text-sm mb-1">
            <span className="font-semibold text-gray-600">Telefone:</span>
            <span className="ml-2 text-gray-900">{cliente.telefone}</span>
          </p>
          <p className="text-sm">
            <span className="font-semibold text-gray-600">CNPJ:</span>
            <span className="ml-2 text-gray-900">{cliente.cnpj || 'N/A'}</span>
          </p>
        </div>
        <div>
          <h3 className="font-bold text-gray-700 mb-3 border-b border-gray-300 pb-2">INFORMAÇÕES DO PEDIDO</h3>
          <p className="text-sm mb-1">
            <span className="font-semibold text-gray-600">Orçamento Origem:</span>
            <span className="ml-2 text-gray-900">{pedido.orcamentoId || 'N/A'}</span>
          </p>
          {pedido.ocCliente && (
            <p className="text-sm mb-1">
              <span className="font-semibold text-gray-600">OC do Cliente:</span>
              <span className="ml-2 text-gray-900 font-bold">{pedido.ocCliente}</span>
            </p>
          )}
          {vendedor && (
            <>
              <p className="text-sm mb-1 mt-3 font-semibold text-blue-900 border-t pt-2">VENDEDOR</p>
              <p className="text-sm mb-1">
                <span className="font-semibold text-gray-600">Nome:</span>
                <span className="ml-2 text-gray-900">{vendedor.nome}</span>
              </p>
              <p className="text-sm mb-1">
                <span className="font-semibold text-gray-600">Email:</span>
                <span className="ml-2 text-gray-900">{vendedor.email}</span>
              </p>
              <p className="text-sm mb-1">
                <span className="font-semibold text-gray-600">Telefone:</span>
                <span className="ml-2 text-gray-900">{vendedor.telefone}</span>
              </p>
              <p className="text-sm">
                <span className="font-semibold text-gray-600">Região:</span>
                <span className="ml-2 text-gray-900">{vendedor.regiao}</span>
              </p>
            </>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-8">
        <h3 className="font-bold text-gray-700 mb-3">ITENS DO PEDIDO</h3>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-200 border border-gray-300">
              <th className="p-2 text-left font-semibold text-gray-700">Código</th>
              <th className="p-2 text-left font-semibold text-gray-700">Descrição</th>
              <th className="p-2 text-center font-semibold text-gray-700">Quantidade</th>
              <th className="p-2 text-right font-semibold text-gray-700">Preço Unitário</th>
              <th className="p-2 text-right font-semibold text-gray-700">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {pedido.itens.map((item, index) => (
              <tr key={index} className="border border-gray-300">
                <td className="p-2 text-gray-900 font-medium">{item.produtoId || '-'}</td>
                <td className="p-2 text-gray-900">{item.descricao || '-'}</td>
                <td className="p-2 text-center text-gray-900">{item.quantidade.toLocaleString('pt-BR')}</td>
                <td className="p-2 text-right text-gray-900">
                  R$ {(item.precoUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="p-2 text-right text-gray-900 font-medium">
                  R$ {(item.precoUnitario * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-64">
          <div className="flex justify-between border-t-2 border-gray-300 pt-4 mb-2">
            <span className="font-semibold text-gray-700">Subtotal:</span>
            <span className="text-gray-900">
              R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="font-semibold text-gray-700">Desconto:</span>
            <span className="text-gray-900">
              R$ {(pedido.desconto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between bg-blue-50 px-3 py-2 rounded font-bold text-lg">
            <span className="text-blue-900">TOTAL:</span>
            <span className="text-blue-900">
              R$ {(valorTotal - (pedido.desconto || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t-2 border-gray-300 pt-6 mt-8 text-center text-xs text-gray-600">
        <p>Este documento foi gerado digitalmente pelo sistema Primardi.</p>
        <p>Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
      </div>
    </div>
  );
}
