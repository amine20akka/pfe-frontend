export const LAYER_CONFIG = {
  cableArtere: {
    id: '9e77351a-98d2-4ed0-93e6-fcaeebd2d3ee',
    name: 'Câbles Artères',
    typename: 'drawing:cable_artere',
    style: {
      stroke: {
        color: '#FF5722',
        width: 3,
        lineDash: [5, 5]
      },
      shadow: {
        color: 'rgba(255, 87, 34, 0.3)',
        width: 6,
        offsetX: 2,
        offsetY: 2
      }
    }
  },
  chambre: {
    id: '71262c57-a0d0-4e6f-98ec-95ac4fade170',
    name: 'Sites Chambre',
    typename: 'drawing:st_chambre',
    style: {
      circle: {
        radius: 5,
        fill: '#03A9F4',
        stroke: '#0277BD',
        strokeWidth: 2
      },
      halo: {
        radius: 0,
        fill: 'rgba(3, 169, 244, 0.3)'
      }
    }
  },
  batiment: {
    id: 'e0ae5305-0968-4cb4-8e7c-80b5750b5623',
    name: 'Bâtiments',
    typename: 'drawing:batiment',
    style: {
      fill: {
        color: 'rgba(178, 116, 255, 0.2)',
        pattern: null
      },
      stroke: {
        color: 'rgb(57, 0, 128)',
        width: 2,
        lineDash: null
      }
    }
  }
};

