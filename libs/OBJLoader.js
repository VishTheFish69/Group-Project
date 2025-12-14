import {
  BufferGeometry,
  DefaultLoadingManager,
  FileLoader,
  Float32BufferAttribute,
  Group,
  LoaderUtils,
  Mesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  Vector3
} from './three.module.js';

class OBJLoader {

  constructor( manager = DefaultLoadingManager ) {

    this.manager = manager;
    this.materials = null;

  }

  setMaterials( materials ) {

    this.materials = materials;
    return this;

  }

  setPath( path ) {

    this.path = path;
    return this;

  }

  load( url, onLoad, onProgress, onError ) {

    const scope = this;
    const loader = new FileLoader( this.manager );
    loader.setPath( this.path );
    loader.load( url, function ( text ) {

      onLoad( scope.parse( text ) );

    }, onProgress, onError );

  }

  parse( text ) {

    function ParserState() {

      const state = {
        objects: [],
        object: {},
        vertices: [],
        normals: [],
        colors: [],
        uvs: [],
        materials: {},
        materialLibraries: [],
        startObject( name, fromDeclaration ) {

          if ( this.object && this.object.fromDeclaration === false ) {

            return;

          }

          const previousMaterial = ( this.object && typeof this.object.currentMaterial === 'function' ? this.object.currentMaterial() : undefined );

          if ( this.object && typeof this.object._finalize === 'function' ) {

            this.object._finalize( true );

          }

          this.object = {
            name: name || '',
            fromDeclaration: ( name !== undefined ),
            geometry: {
              vertices: [],
              normals: [],
              colors: [],
              uvs: []
            },
            materials: [],
            smooth: true,

            startMaterial: function ( name, libraries ) {

              const previous = this._finalize( false );

              if ( previous && ( previous.inherited || previous.groupCount <= 0 ) ) {

                this.materials.splice( previous.index, 1 );

              }

              const material = {
                index: this.materials.length,
                name: name || '',
                mtllib: ( Array.isArray( libraries ) && libraries.length > 0 ? libraries[ libraries.length - 1 ] : '' ),
                smooth: ( previous !== undefined ? previous.smooth : this.smooth ),
                groupStart: ( previous !== undefined ? previous.groupEnd : 0 ),
                groupEnd: - 1,
                groupCount: - 1,
                inherited: false,

                clone: function ( index ) {

                  const cloned = {
                    index: ( typeof index === 'number' ? index : this.index ),
                    name: this.name,
                    mtllib: this.mtllib,
                    smooth: this.smooth,
                    groupStart: 0,
                    groupEnd: - 1,
                    groupCount: - 1,
                    inherited: false
                  };
                  cloned.clone = this.clone.bind( cloned );
                  return cloned;

                }
              };

              this.materials.push( material );
              return material;

            },

            currentMaterial: function () {

              if ( this.materials.length > 0 ) {

                return this.materials[ this.materials.length - 1 ];

              }

              return undefined;

            },

            _finalize: function ( end ) {

              const lastMultiMaterial = this.currentMaterial();
              if ( lastMultiMaterial && lastMultiMaterial.groupEnd === - 1 ) {

                lastMultiMaterial.groupEnd = this.geometry.vertices.length / 3;
                lastMultiMaterial.groupCount = lastMultiMaterial.groupEnd - lastMultiMaterial.groupStart;
                lastMultiMaterial.inherited = false;

              }

              if ( end && this.materials.length > 1 ) {

                for ( let i = this.materials.length - 1; i >= 0; i -- ) {

                  if ( this.materials[ i ].groupCount <= 0 ) {

                    this.materials.splice( i, 1 );

                  }

                }

              }

              if ( end && this.materials.length === 0 ) {

                this.materials.push( {
                  name: '',
                  smooth: this.smooth
                } );

              }

              return lastMultiMaterial;

            }
          };

          if ( previousMaterial !== undefined && typeof previousMaterial.clone === 'function' ) {

            const declared = previousMaterial.clone( 0 );
            declared.inherited = true;
            this.object.materials.push( declared );

          }

          this.objects.push( this.object );

        },

        finalize: function () {

          if ( this.object && typeof this.object._finalize === 'function' ) {

            this.object._finalize( true );

          }

        },

        parseVertexIndex: function ( value ) {

          const index = parseInt( value, 10 );
          return ( index >= 0 ? index - 1 : index + this.vertices.length / 3 );

        },

        parseNormalIndex: function ( value ) {

          const index = parseInt( value, 10 );
          return ( index >= 0 ? index - 1 : index + this.normals.length / 3 );

        },

        parseUVIndex: function ( value ) {

          const index = parseInt( value, 10 );
          return ( index >= 0 ? index - 1 : index + this.uvs.length / 2 );

        },

        addVertex: function ( a, b, c ) {

          this.object.geometry.vertices.push( a, b, c );

        },

        addVertexPoint: function ( a ) {

          this.object.geometry.vertices.push( a );

        },

        addVertexColor: function ( a, b, c ) {

          this.object.geometry.colors.push( a, b, c );

        },

        addNormal: function ( a, b, c ) {

          this.object.geometry.normals.push( a, b, c );

        },

        addUV: function ( a, b ) {

          this.object.geometry.uvs.push( a, b );

        },

        addFace: function ( a, b, c, ua, ub, uc, na, nb, nc ) {

          const vLen = this.vertices.length;
          let ia = this.parseVertexIndex( a, vLen );
          let ib = this.parseVertexIndex( b, vLen );
          let ic = this.parseVertexIndex( c, vLen );

          this.addVertex( ia * 3 + 0, ia * 3 + 1, ia * 3 + 2 );
          this.addVertex( ib * 3 + 0, ib * 3 + 1, ib * 3 + 2 );
          this.addVertex( ic * 3 + 0, ic * 3 + 1, ic * 3 + 2 );

          if ( ua !== undefined && ua !== '' ) {

            const uvLen = this.uvs.length;
            ia = this.parseUVIndex( ua, uvLen );
            ib = this.parseUVIndex( ub, uvLen );
            ic = this.parseUVIndex( uc, uvLen );
            this.addUV( ia * 2 + 0, ia * 2 + 1 );
            this.addUV( ib * 2 + 0, ib * 2 + 1 );
            this.addUV( ic * 2 + 0, ic * 2 + 1 );

          }

          if ( na !== undefined && na !== '' ) {

            const nLen = this.normals.length;
            ia = this.parseNormalIndex( na, nLen );
            ib = this.parseNormalIndex( nb, nLen );
            ic = this.parseNormalIndex( nc, nLen );
            this.addNormal( ia * 3 + 0, ia * 3 + 1, ia * 3 + 2 );
            this.addNormal( ib * 3 + 0, ib * 3 + 1, ib * 3 + 2 );
            this.addNormal( ic * 3 + 0, ic * 3 + 1, ic * 3 + 2 );

          }

        },

        addPointGeometry: function ( vertices ) {

          this.object.geometry.type = 'Points';
          const vLen = this.vertices.length;

          for ( let vi = 0, l = vertices.length; vi < l; vi ++ ) {

            this.addVertexPoint( this.parseVertexIndex( vertices[ vi ], vLen ) * 3 );

          }

        },

        addLineGeometry: function ( vertices, uvs ) {

          this.object.geometry.type = 'Line';
          const vLen = this.vertices.length;
          const uvLen = this.uvs.length;

          for ( let vi = 0, l = vertices.length; vi < l; vi ++ ) {

            this.addVertex( this.parseVertexIndex( vertices[ vi ], vLen ) * 3 );

          }

          for ( let uvi = 0, l = uvs.length; uvi < l; uvi ++ ) {

            this.addUV( this.parseUVIndex( uvs[ uvi ], uvLen ) * 2 );

          }

        }

      };
      state.startObject( '', false );
      return state;

    }

    const state = new ParserState();
    const trimLeft = ( str ) => str.replace( /^[\s]+/, '' );

    const lines = text.split( '\n' );
    for ( let i = 0, l = lines.length; i < l; i ++ ) {

      let line = lines[ i ];
      line = line.trim();
      if ( line.length === 0 || line.charAt( 0 ) === '#' ) continue;
      const lineFirstChar = line.charAt( 0 );

      if ( lineFirstChar === 'v' ) {

        const data = trimLeft( line.substring( 1 ) ).split( /\s+/ );
        if ( line.charAt( 1 ) === ' ' ) {

          state.vertices.push( parseFloat( data[ 0 ] ), parseFloat( data[ 1 ] ), parseFloat( data[ 2 ] ) );

        } else if ( line.charAt( 1 ) === 'n' ) {

          state.normals.push( parseFloat( data[ 0 ] ), parseFloat( data[ 1 ] ), parseFloat( data[ 2 ] ) );

        } else if ( line.charAt( 1 ) === 't' ) {

          state.uvs.push( parseFloat( data[ 0 ] ), parseFloat( data[ 1 ] ) );

        }

      } else if ( lineFirstChar === 'f' ) {

        const lineData = line.substring( 1 ).trim();
        const vertexData = lineData.split( /\s+/ );
        const v1 = vertexData[ 0 ].split( '/' );
        const v2 = vertexData[ 1 ].split( '/' );
        const v3 = vertexData[ 2 ].split( '/' );

        state.addFace( v1[ 0 ], v2[ 0 ], v3[ 0 ], v1[ 1 ], v2[ 1 ], v3[ 1 ], v1[ 2 ], v2[ 2 ], v3[ 2 ] );

        for ( let j = 3, jl = vertexData.length; j < jl; j ++ ) {

          const v4 = vertexData[ j ].split( '/' );
          state.addFace( v1[ 0 ], v3[ 0 ], v4[ 0 ], v1[ 1 ], v3[ 1 ], v4[ 1 ], v1[ 2 ], v3[ 2 ], v4[ 2 ] );

        }

      } else if ( lineFirstChar === 'l' ) {

        const lineParts = line.substring( 1 ).trim().split( ' ' );
        const lineVertices = [], lineUVs = [];

        if ( line.indexOf( '/' ) === - 1 ) {

          lineVertices.push( lineParts[ 0 ] );
          lineVertices.push( lineParts[ 1 ] );

        } else {

          for ( let li = 0, llen = lineParts.length; li < llen; li ++ ) {

            const parts = lineParts[ li ].split( '/' );
            if ( parts[ 0 ] !== '' ) lineVertices.push( parts[ 0 ] );
            if ( parts[ 1 ] !== '' ) lineUVs.push( parts[ 1 ] );

          }

        }

        state.addLineGeometry( lineVertices, lineUVs );

      } else if ( lineFirstChar === 'p' ) {

        const lineData = line.substring( 1 ).trim().split( ' ' );
        state.addPointGeometry( lineData );

      } else if ( ( lineFirstChar === 'g' || lineFirstChar === 'o' ) ) {

        const name = line.substring( 1 ).trim();
        state.startObject( name, true );

      } else if ( lineFirstChar === 's' ) {

        const result = line.substring( 1 ).trim().toLowerCase();
        state.object.smooth = ( result !== '0' && result !== 'off' );
        const material = state.object.currentMaterial();
        if ( material ) material.smooth = state.object.smooth;

      } else if ( lineFirstChar === 'm' && ( line.substr( 0, 6 ) === 'mtllib' ) ) {

        state.materialLibraries.push( line.substring( 7 ).trim() );

      } else if ( lineFirstChar === 'u' && ( line.substr( 0, 6 ) === 'usemtl' ) ) {

        state.object.startMaterial( line.substring( 7 ).trim(), state.materialLibraries );

      }

    }

    state.finalize();

    function createParserObject( name, geometry, materials ) {

      if ( geometry.vertices.length === 0 ) return null;
      const buffergeometry = new BufferGeometry();
      buffergeometry.setAttribute( 'position', new Float32BufferAttribute( geometry.vertices, 3 ) );

      if ( geometry.normals.length > 0 ) {

        buffergeometry.setAttribute( 'normal', new Float32BufferAttribute( geometry.normals, 3 ) );

      } else {

        buffergeometry.computeVertexNormals();

      }

      if ( geometry.colors.length > 0 ) {

        buffergeometry.setAttribute( 'color', new Float32BufferAttribute( geometry.colors, 3 ) );

      }

      if ( geometry.uvs.length > 0 ) {

        buffergeometry.setAttribute( 'uv', new Float32BufferAttribute( geometry.uvs, 2 ) );

      }

      const createdMaterials = [];
      for ( let mi = 0, miLen = materials.length; mi < miLen; mi ++ ) {

        const sourceMaterial = materials[ mi ];
        const material = this.materials !== null ? this.materials.create( sourceMaterial.name ) : new MeshPhongMaterial();
        material.flatShading = ! sourceMaterial.smooth;
        createdMaterials.push( material );

      }

      let mesh;
      if ( createdMaterials.length > 1 ) {

        for ( let mi = 0, miLen = materials.length; mi < miLen; mi ++ ) {

          const sourceMaterial = materials[ mi ];
          buffergeometry.addGroup( sourceMaterial.groupStart, sourceMaterial.groupCount, mi );

        }

        mesh = new Mesh( buffergeometry, createdMaterials );

      } else {

        mesh = new Mesh( buffergeometry, createdMaterials[ 0 ] );

      }

      mesh.name = name;
      return mesh;

    }

    const container = new Group();
    const hasPrimitives = ( state.vertices.length > 0 );

    if ( hasPrimitives === true ) {

      for ( let i = 0, l = state.objects.length; i < l; i ++ ) {

        const object = state.objects[ i ];
        const geometry = object.geometry;
        const materials = object.materials;
        const mesh = createParserObject.call( this, object.name, geometry, materials );
        if ( mesh !== null ) container.add( mesh );

      }

    } else {

      if ( state.vertices.length > 0 ) {

        const material = new MeshLambertMaterial();
        const mesh = new Mesh( new BufferGeometry(), material );
        container.add( mesh );

      }

    }

    return container;

  }

}

export { OBJLoader };
