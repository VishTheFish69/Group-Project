import {
  Color,
  DefaultLoadingManager,
  FileLoader,
  MeshPhongMaterial,
  RepeatWrapping,
  TextureLoader,
  DoubleSide
} from './three.module.js';

class MTLLoader {

  constructor( manager = DefaultLoadingManager ) {

    this.manager = manager;
    this.materials = null;
    this.materialOptions = null;
    this.path = '';
    this.resourcePath = '';

  }

  setMaterialOptions( value ) {

    this.materialOptions = value;
    return this;

  }

  setPath( path ) {

    this.path = path;
    return this;

  }

  setResourcePath( path ) {

    this.resourcePath = path;
    return this;

  }

  load( url, onLoad, onProgress, onError ) {

    const scope = this;
    const path = this.path || this.resourcePath;

    const loader = new FileLoader( this.manager );
    loader.setPath( this.path );
    loader.setResponseType( 'text' );
    loader.load( url, function ( text ) {

      try {

        onLoad( scope.parse( text, path ) );

      } catch ( e ) {

        if ( onError ) {

          onError( e );

        } else {

          console.error( e );

        }

        scope.manager.itemError( url );

      }

    }, onProgress, onError );

  }

  parse( text, path ) {

    const lines = text.split( '\n' );
    let info = null;
    const delimiter_pattern = /\s+/;
    const materialsInfo = {};

    for ( let i = 0; i < lines.length; i ++ ) {

      let line = lines[ i ];
      line = line.trim();

      if ( line.length === 0 || line.charAt( 0 ) === '#' ) {

        continue;

      }

      const pos = line.indexOf( ' ' );
      let key = ( pos >= 0 ) ? line.substring( 0, pos ) : line;
      key = key.toLowerCase();
      let value = ( pos >= 0 ) ? line.substring( pos + 1 ) : '';

      if ( key === 'newmtl' ) {

        info = { name: value };
        materialsInfo[ value ] = info;

      } else if ( info ) {

        if ( key === 'ka' || key === 'kd' || key === 'ks' ) {

          const ss = value.split( delimiter_pattern, 3 );
          info[ key ] = [ parseFloat( ss[ 0 ] ), parseFloat( ss[ 1 ] ), parseFloat( ss[ 2 ] ) ];

        } else {

          info[ key ] = value;

        }

      }

    }

    const materialCreator = new MaterialCreator( this.resourcePath || path, this.materialOptions );
    materialCreator.setCrossOrigin( this.crossOrigin );
    materialCreator.setManager( this.manager );
    materialCreator.setMaterials( materialsInfo );
    this.materials = materialCreator;
    return materialCreator;

  }

}

class MaterialCreator {

  constructor( baseUrl = '', options = {} ) {

    this.baseUrl = baseUrl;
    this.options = options || {};
    this.materialsInfo = {};
    this.materials = {};
    this.materialsArray = [];
    this.nameLookup = {};
    this.side = ( this.options.side !== undefined ) ? this.options.side : DoubleSide;
    this.wrap = ( this.options.wrap !== undefined ) ? this.options.wrap : RepeatWrapping;

  }

  setCrossOrigin( value ) {

    this.crossOrigin = value;
    return this;

  }

  setManager( value ) {

    this.manager = value;
    return this;

  }

  setMaterials( materialsInfo ) {

    this.materialsInfo = this.convert( materialsInfo );
    this.materials = {};
    this.materialsArray = [];
    this.nameLookup = {};

  }

  convert( materialsInfo ) {

    if ( ! this.options.normalizeRGB ) return materialsInfo;

    const converted = {};

    for ( const mn in materialsInfo ) {

      const mat = materialsInfo[ mn ];
      const cov = {};

      for ( const prop in mat ) {

        let save = true;
        let value = mat[ prop ];

        if ( Array.isArray( value ) ) {

          value = value.slice( 0 );

          if ( prop === 'kd' || prop === 'ka' || prop === 'ks' ) {

            value[ 0 ] *= 1 / 255;
            value[ 1 ] *= 1 / 255;
            value[ 2 ] *= 1 / 255;

          }

        } else {

          save = false;

        }

        if ( save ) cov[ prop ] = value;

      }

      converted[ mn ] = cov;

    }

    return converted;

  }

  preload() {

    for ( const mn in this.materialsInfo ) {

      this.create( mn );

    }

  }

  getIndex( materialName ) {

    return this.nameLookup[ materialName ];

  }

  getAsArray() {

    let index = 0;
    for ( const mn in this.materialsInfo ) {

      this.materialsArray[ index ] = this.create( mn );
      this.nameLookup[ mn ] = index;
      index ++;

    }

    return this.materialsArray;

  }

  create( materialName ) {

    if ( this.materials[ materialName ] !== undefined ) {

      return this.materials[ materialName ];

    }

    const scope = this;
    const mat = this.materialsInfo[ materialName ];
    const params = {
      name: materialName,
      side: this.side
    };

    function resolveURL( baseUrl, url ) {

      if ( typeof url !== 'string' || url === '' ) return '';
      if ( /^https?:\/\//i.test( url ) ) return url;
      return baseUrl + url;

    }

    function setMapForType( mapType, value ) {

      if ( params[ mapType ] ) return;
      params[ mapType ] = scope.loadTexture( resolveURL( scope.baseUrl, value ) );
      params[ mapType ].wrapS = scope.wrap;
      params[ mapType ].wrapT = scope.wrap;

    }

    for ( const prop in mat ) {

      const value = mat[ prop ];
      if ( value === '' ) continue;

      switch ( prop.toLowerCase() ) {

        case 'kd':
          params.color = new Color().fromArray( value );
          break;
        case 'ka':
          params.emissive = new Color().fromArray( value );
          break;
        case 'ks':
          params.specular = new Color().fromArray( value );
          break;
        case 'map_kd':
          setMapForType( 'map', value );
          break;
        case 'map_ks':
          setMapForType( 'specularMap', value );
          break;
        case 'map_bump':
        case 'bump':
          setMapForType( 'bumpMap', value );
          break;
        case 'ns':
          params.shininess = parseFloat( value );
          break;
        case 'd':
          if ( value < 1 ) {

            params.opacity = value;
            params.transparent = true;

          }
          break;
        case 'tr':
          if ( value > 0 ) {

            params.opacity = 1 - value;
            params.transparent = true;

          }
          break;
        case 'map_d':
          setMapForType( 'alphaMap', value );
          params.transparent = true;
          break;
        case 'map_ao':
          setMapForType( 'aoMap', value );
          break;
        default:
          break;

      }

    }

    this.materials[ materialName ] = new MeshPhongMaterial( params );
    return this.materials[ materialName ];

  }

  loadTexture( url, mapping, onLoad, onProgress, onError ) {

    const textureLoader = new TextureLoader( this.manager );
    textureLoader.setCrossOrigin( this.crossOrigin );
    textureLoader.setPath( this.resourcePath || this.baseUrl );
    const texture = textureLoader.load( url, onLoad, onProgress, onError );
    if ( mapping !== undefined ) texture.mapping = mapping;
    return texture;

  }

}

export { MTLLoader };
