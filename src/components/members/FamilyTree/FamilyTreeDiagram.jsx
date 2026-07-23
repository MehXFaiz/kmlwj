import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { groupByGeneration, relationshipLabel } from '../../../utils/familyRelations';

const NodeCard = ({ member, sublabel, center = false, onClick }) => (
  <div
    onClick={onClick}
    className={`shrink-0 w-36 sm:w-40 rounded-xl border p-2.5 text-center cursor-pointer transition-all ${
      center
        ? 'bg-amber-500/15 border-amber-500 shadow-lg shadow-amber-600/20 ring-1 ring-amber-500/40'
        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
    }`}
  >
    {member.photoUrl ? (
      <img src={member.photoUrl} alt={member.fullName} className="w-10 h-10 rounded-lg object-cover border border-slate-700 mx-auto mb-1.5" />
    ) : (
      <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center font-bold text-xs text-amber-400 mx-auto mb-1.5">
        {member.fullName?.charAt(0) || 'M'}
      </div>
    )}
    <p className="text-[11px] font-bold text-slate-100 leading-tight truncate">{member.fullName}</p>
    <p className="text-[9px] font-bold uppercase tracking-wider text-amber-400 mt-0.5">{sublabel}</p>
  </div>
);

const Connector = () => (
  <div className="flex flex-col items-center">
    <div className="w-px h-4 bg-slate-700 print:bg-slate-400" />
  </div>
);

const GenerationRow = ({ items, onNodeClick }) => {
  if (items.length === 0) return null;
  return (
    <div className="relative">
      <div className="flex items-start justify-center gap-4 flex-wrap">
        {items.map((rel) => (
          <NodeCard
            key={rel.id}
            member={rel.relatedMember}
            sublabel={relationshipLabel(rel.relationshipType, rel.customLabel)}
            onClick={() => onNodeClick(rel.relatedMember.id)}
          />
        ))}
      </div>
    </div>
  );
};

// Renders a generation-banded org-chart with the selected member centered.
// Bands come pre-grouped from groupByGeneration: -2 grandparents, -1 parents/
// aunts-uncles, 0 spouse/siblings/cousins, 1 children/nieces-nephews, 2 grandchildren.
export const FamilyTreeDiagram = ({ member, relations, printId = 'print-family-tree' }) => {
  const navigate = useNavigate();
  const bands = groupByGeneration(relations);
  const goTo = (id) => navigate(`/members/${id}`);

  const hasAny = relations.length > 0;

  return (
    <div>
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          *, *::before, *::after { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body * { visibility: hidden !important; }
          #${printId}, #${printId} * { visibility: visible !important; }
          #${printId} { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      <div className="flex items-center justify-between mb-4 print:hidden">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Visual Family Tree</h3>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
        >
          <Printer className="w-3.5 h-3.5 text-amber-400" />
          Print Family Tree
        </button>
      </div>

      <div id={printId} className="bg-slate-950/50 border border-slate-800 rounded-2xl p-6 overflow-x-auto print:bg-white print:border-none">
        {!hasAny ? (
          <p className="text-xs text-slate-500 text-center py-10">
            No family members linked yet. Use "Link Family Member" to start building the tree.
          </p>
        ) : (
          <div className="flex flex-col items-center gap-3 min-w-max mx-auto">
            <GenerationRow items={bands['-2']} onNodeClick={goTo} />
            {bands['-2'].length > 0 && <Connector />}

            <GenerationRow items={bands['-1']} onNodeClick={goTo} />
            {bands['-1'].length > 0 && <Connector />}

            {/* Selected member + same-generation relatives (spouse/siblings/cousins) */}
            <div className="flex items-start justify-center gap-4 flex-wrap">
              {bands['0'].filter((r) => ['HUSBAND', 'WIFE'].includes(r.relationshipType) === false && ['BROTHER', 'SISTER', 'COUSIN'].includes(r.relationshipType)).slice(0, 4).map((rel) => (
                <NodeCard key={rel.id} member={rel.relatedMember} sublabel={relationshipLabel(rel.relationshipType, rel.customLabel)} onClick={() => goTo(rel.relatedMember.id)} />
              ))}
              <NodeCard member={member} sublabel="Selected Member" center onClick={() => {}} />
              {bands['0'].filter((r) => ['HUSBAND', 'WIFE'].includes(r.relationshipType)).map((rel) => (
                <NodeCard key={rel.id} member={rel.relatedMember} sublabel={relationshipLabel(rel.relationshipType, rel.customLabel)} onClick={() => goTo(rel.relatedMember.id)} />
              ))}
            </div>

            {bands['1'].length > 0 && <Connector />}
            <GenerationRow items={bands['1']} onNodeClick={goTo} />

            {bands['2'].length > 0 && <Connector />}
            <GenerationRow items={bands['2']} onNodeClick={goTo} />
          </div>
        )}
      </div>
    </div>
  );
};
