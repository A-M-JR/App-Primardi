import { Orcamento, Cliente, Vendedor } from '@/lib/types';

interface PDFQuotationProps {
  orcamento: Orcamento;
  cliente: Cliente;
  vendedor?: Vendedor;
}

export function PDFQuotation({ orcamento, cliente, vendedor }: PDFQuotationProps) {
  const dataEmissao = new Date(orcamento.dataEmissao || orcamento.criadoEm).toLocaleDateString('pt-BR');
  const dataValidade = new Date(orcamento.dataValidade || orcamento.criadoEm).toLocaleDateString('pt-BR');
  const valorTotal = orcamento.itens.reduce((sum, item) => sum + item.precoUnitario * item.quantidade, 0);

  return (
    <div id="pdf-content" className="w-full p-8 bg-white text-black" style={{ minHeight: '297mm' }}>
      {/* Header */}
      <div className="border-b-2 border-gray-300 pb-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-blue-900">NEWFLEXO</h1>
            <p className="text-sm text-gray-600">Gestão Comercial de Produtos</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-gray-700">ORÇAMENTO</h2>
            <p className="text-lg font-semibold text-blue-900">#{orcamento.id}</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-600 font-semibold">Data de Emissão</p>
            <p className="text-gray-900">{dataEmissao}</p>
          </div>
          <div>
            <p className="text-gray-600 font-semibold">Data de Validade</p>
            <p className="text-gray-900">{dataValidade}</p>
          </div>
          <div>
            <p className="text-gray-600 font-semibold">Status</p>
            <p className="text-gray-900 font-medium capitalize">{orcamento.status}</p>
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
          <p className="text-sm">
            <span className="font-semibold text-gray-600">Telefone:</span>
            <span className="ml-2 text-gray-900">{cliente.telefone}</span>
          </p>
          {orcamento.ocCliente && (
            <p className="text-sm mt-1">
              <span className="font-semibold text-gray-600">OC do Cliente:</span>
              <span className="ml-2 text-gray-900 font-bold">{orcamento.ocCliente}</span>
            </p>
          )}
        </div>
        <div>
          <h3 className="font-bold text-gray-700 mb-3 border-b border-gray-300 pb-2">INFORMAÇÕES DO VENDEDOR</h3>
          {vendedor ? (
            <>
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
          ) : (
            <p className="text-sm text-gray-600">Informações do vendedor não disponíveis</p>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-8">
        <h3 className="font-bold text-gray-700 mb-3">ITENS DO ORÇAMENTO</h3>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-200 border border-gray-300">
              <th className="p-2 text-left font-semibold text-gray-700">Descrição</th>
              <th className="p-2 text-center font-semibold text-gray-700">Quantidade</th>
              <th className="p-2 text-center font-semibold text-gray-700">Unidade</th>
              <th className="p-2 text-right font-semibold text-gray-700">Preço Unitário</th>
              <th className="p-2 text-right font-semibold text-gray-700">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {orcamento.itens.map((item, index) => (
              <tr key={index} className="border border-gray-300">
                <td className="p-2 text-gray-900 border border-gray-300">
                  <div className="whitespace-pre-line">{item.descricao}</div>
                  {item.observacao && (
                    <div className="text-xs text-red-600 font-bold italic mt-1 border-l-2 border-red-200 pl-2 ml-1">
                      OBS: {item.observacao}
                    </div>
                  )}
                </td>
                <td className="p-2 text-center text-gray-900">{item.quantidade.toLocaleString('pt-BR')}</td>
                <td className="p-2 text-center text-gray-900">{item.unidade}</td>
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
              R$ {(orcamento.desconto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between bg-blue-50 px-3 py-2 rounded font-bold text-lg">
            <span className="text-blue-900">TOTAL:</span>
            <span className="text-blue-900">
              R$ {(valorTotal - (orcamento.desconto || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Observations */}
      {orcamento.observacoes && (
        <div className="mb-6">
          <h3 className="font-bold text-gray-700 mb-2">OBSERVAÇÕES</h3>
          <p className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded">
            {orcamento.observacoes}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="border-t-2 border-gray-300 pt-6 mt-8 text-center text-xs text-gray-600">
        <p>Este documento foi gerado digitalmente pelo sistema Primardi.</p>
        <p>Validade da cotação: {dataValidade}</p>
        <p>Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
      </div>
    </div>
  );
}
