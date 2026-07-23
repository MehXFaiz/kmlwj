import api from './api';

export const familyTreeService = {
  // depth=2 also pulls each direct relative's own links (grandparents/grandchildren)
  // in the same round-trip, so the tree view never fires one request per node.
  getRelations: (memberId, { extended = false } = {}) =>
    api
      .get('/api/v1/family-relationships', { params: { memberId, depth: extended ? '2' : undefined } })
      .then((res) => res.data.data),

  addRelation: (payload) =>
    api.post('/api/v1/family-relationships', payload).then((res) => res.data.data),

  removeRelation: (memberId, relatedMemberId) =>
    api
      .delete('/api/v1/family-relationships', { params: { memberId, relatedMemberId } })
      .then((res) => res.data),
};
