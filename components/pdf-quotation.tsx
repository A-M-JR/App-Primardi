import { Orcamento, Cliente, Vendedor } from '@/lib/types';
import { Building2, Mail, MapPin, Phone, User } from 'lucide-react';

interface PDFQuotationProps {
  orcamento: Orcamento;
  cliente: Cliente;
  vendedor?: Vendedor;
}

export function PDFQuotation({ orcamento, cliente, vendedor }: PDFQuotationProps) {
  const dataEmissao = new Date(orcamento.dataEmissao || orcamento.criadoEm).toLocaleDateString('pt-BR');
  const dataValidade = new Date(orcamento.dataValidade || orcamento.criadoEm).toLocaleDateString('pt-BR');
  const valorTotal = orcamento.itens.reduce((sum, item) => sum + item.precoUnitario * item.quantidade, 0);

  const enderecoFormatado = `${cliente.logradouro || ''}, ${cliente.numeroEnd || 'S/N'} ${cliente.bairro ? '- ' + cliente.bairro : ''}`.replace(/^, | , /g, '').trim();

  return (
    <div id="pdf-content" className="w-full bg-white text-gray-800 font-sans relative overflow-hidden shadow-xl" style={{ minHeight: '297mm', width: '210mm', margin: '0 auto', padding: '0' }}>
      
      {/* Top Banner */}
      <div className="h-4 w-full bg-[#063A1F]"></div>
      <div className="h-1.5 w-full bg-[#00E676]"></div>

      <div className="p-10 pb-16">
        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div className="flex items-center gap-4">
            {/* Logo Placeholder - It will use the actual image if you add an img tag here, but we use text/styled box as fallback */}
            <div className="w-24 h-24 bg-[#F4F6F6] rounded-xl flex items-center justify-center p-2 border border-gray-100">
               <img src="/logo_sem_fundo_primardi.png" alt="Primardi" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.style.display = 'none' }} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-[#063A1F] tracking-tight uppercase">PRIMARDI</h1>
              <p className="text-sm font-medium text-gray-500 uppercase tracking-widest mt-1">SISTEMA DE GESTÃO</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">DOCUMENTO OFICIAL</h2>
            <p className="text-3xl font-black text-[#063A1F] mb-2">{orcamento.numero}</p>
            <div className="inline-block bg-[#F4F6F6] text-[#063A1F] px-3 py-1 rounded-md text-xs font-bold border border-gray-100">
              EMISSÃO: {dataEmissao}
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-6 mb-10">
          {/* Cliente */}
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
              <Building2 className="w-4 h-4 text-[#00E676]" />
              <h3 className="font-bold text-[#063A1F] uppercase text-xs tracking-wider">Dados do Proponente</h3>
            </div>
            <div className="space-y-2">
              <p className="font-bold text-gray-900 text-base">{cliente.razaoSocial}</p>
              <p className="text-xs text-gray-500 font-mono">CNPJ: {cliente.cnpj} {cliente.ie && `| IE: ${cliente.ie}`}</p>
              
              <div className="flex items-start gap-2 mt-3 pt-3 border-t border-gray-100">
                <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-600 leading-tight">
                  {enderecoFormatado || 'Endereço não informado'}<br/>
                  {cliente.cidade}/{cliente.estado} - CEP: {cliente.cep}
                </p>
              </div>
              {cliente.telefone && (
                <div className="flex items-center gap-2 mt-1">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  <p className="text-xs text-gray-600">{cliente.telefone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Comercial */}
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
              <User className="w-4 h-4 text-[#00E676]" />
              <h3 className="font-bold text-[#063A1F] uppercase text-xs tracking-wider">Informações Comerciais</h3>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 text-xs">
                <span className="col-span-1 text-gray-500 font-medium">Representante:</span>
                <span className="col-span-2 font-semibold text-gray-900">{vendedor?.nome || 'N/D'}</span>
              </div>
              <div className="grid grid-cols-3 text-xs">
                <span className="col-span-1 text-gray-500 font-medium">Pagamento:</span>
                <span className="col-span-2 font-semibold text-gray-900">{orcamento.formaPagamentoObj?.nome || 'A Combinar'}</span>
              </div>
              <div className="grid grid-cols-3 text-xs">
                <span className="col-span-1 text-gray-500 font-medium">Validade:</span>
                <span className="col-span-2 font-semibold text-gray-900">15 Dias Corridos</span>
              </div>
              <div className="grid grid-cols-3 text-xs">
                <span className="col-span-1 text-gray-500 font-medium">Frete:</span>
                <span className="col-span-2 font-semibold text-gray-900">{orcamento.tipoFrete || 'N/D'}</span>
              </div>
              {orcamento.ocCliente && (
                <div className="grid grid-cols-3 text-xs pt-2 border-t border-gray-200">
                  <span className="col-span-1 text-gray-500 font-medium">Sua Ref (OC):</span>
                  <span className="col-span-2 font-bold text-[#063A1F]">{orcamento.ocCliente}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-8 rounded-xl overflow-hidden border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#063A1F] text-white">
                <th className="py-3 px-4 text-left font-bold text-xs uppercase tracking-wider">Descrição do Produto</th>
                <th className="py-3 px-4 text-center font-bold text-xs uppercase tracking-wider w-20">Qtd</th>
                <th className="py-3 px-4 text-center font-bold text-xs uppercase tracking-wider w-20">Un</th>
                <th className="py-3 px-4 text-right font-bold text-xs uppercase tracking-wider w-32">Preço Unit.</th>
                <th className="py-3 px-4 text-right font-bold text-xs uppercase tracking-wider w-32">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orcamento.itens.map((item, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="py-4 px-4">
                    <div className="font-semibold text-gray-900">{item.descricao.split('\n')[0]}</div>
                    {item.descricao.split('\n').length > 1 && (
                      <div className="text-xs text-gray-500 mt-1">{item.descricao.split('\n').slice(1).join('\n')}</div>
                    )}
                    {item.observacao && (
                      <div className="text-xs text-red-600 font-bold italic mt-2 border-l-2 border-red-500 pl-2 py-0.5 bg-red-50/50 inline-block pr-3">
                        OBS: {item.observacao}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-center font-medium text-gray-700">{item.quantidade.toLocaleString('pt-BR')}</td>
                  <td className="py-4 px-4 text-center text-gray-500 text-xs">{item.unidade}</td>
                  <td className="py-4 px-4 text-right font-mono text-gray-700 text-xs">
                    R$ {(item.precoUnitario).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-4 px-4 text-right font-mono font-bold text-[#063A1F]">
                    R$ {(item.precoUnitario * item.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & Observations */}
        <div className="flex gap-8 items-start mb-16">
          <div className="flex-1">
             {orcamento.observacoes && (
                <div>
                  <h3 className="font-bold text-[#063A1F] uppercase text-xs tracking-wider mb-2">Observações Importantes</h3>
                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl">
                    <p className="text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">
                      {orcamento.observacoes}
                    </p>
                  </div>
                </div>
              )}
          </div>
          
          <div className="w-80 shrink-0">
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-500">Subtotal</span>
                <span className="font-mono text-gray-900">
                  R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium text-gray-500">Desconto</span>
                <span className="font-mono text-red-600">
                  - R$ {(orcamento.desconto || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              
              <div className="pt-4 border-t border-gray-200 flex justify-between items-end">
                <span className="text-xs font-bold text-[#063A1F] uppercase tracking-wider pb-1">Total Final</span>
                <span className="text-2xl font-black text-[#00E676] tracking-tight">
                  <span className="text-sm mr-1 text-[#063A1F]">R$</span>
                  {(valorTotal - (orcamento.desconto || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="grid grid-cols-2 gap-16 mt-12 px-8">
          <div className="text-center">
            <div className="border-t border-gray-400 pt-3">
              <p className="text-xs font-bold text-gray-800">Representante Comercial</p>
              <p className="text-[10px] text-gray-500 mt-1">Primardi Distribuição</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 pt-3">
              <p className="text-xs font-bold text-gray-800">Aprovação do Cliente</p>
              <p className="text-[10px] text-gray-500 mt-1">{cliente.razaoSocial}</p>
            </div>
          </div>
        </div>

      </div>

      {/* Footer Strip */}
      <div className="absolute bottom-0 left-0 w-full bg-[#063A1F] text-white py-4 px-10 flex justify-between items-center">
        <p className="text-[10px] opacity-70 tracking-widest uppercase">
          Documento Confidencial • Gerado pelo Sistema Primardi
        </p>
        <p className="text-[10px] opacity-70 font-mono">
          {new Date().toLocaleString('pt-BR')}
        </p>
      </div>

    </div>
  );
}
