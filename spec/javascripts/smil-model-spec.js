var smil = "";
smil += "<smil xmlns='http://www.w3.org/ns/SMIL' xmlns:epub='http://www.idpf.org/2007/ops' version='3.0'>";
smil += "<body id='mo1' epub:textref='test.xhtml#start'>";

// real life pars 
smil += "<par id='mo1_par1'>";
smil += "<text src='valentinhauy.xhtml#rgn_cnt_0001' id='mo1_par1_text'/>";
smil += "<audio clipBegin='0s' clipEnd='2.504s' id='mo1_par1_audio' src='hauy_0001.mp3'/>";
smil += "</par>";
smil += "<par id='mo1_par2'>";
smil += "<text src='valentinhauy.xhtml#rgn_cnt_0002' id='mo1_par2_text'/>";
smil += "<audio clipBegin='2.504s' clipEnd='6.454s' id='mo1_par2_audio' src='hauy_0001.mp3'/>";
smil += "</par>";
smil += "<par id='mo1_par3'>";
smil += "<text src='valentinhauy.xhtml#rgn_cnt_0003' id='mo1_par3_text'/>";
smil += "<audio clipBegin='6.454s' clipEnd='9.775s' id='mo1_par3_audio' src='hauy_0001.mp3'/>";
smil += "</par>";
smil += "<par id='mo1_par4'>";
smil += "<text src='valentinhauy.xhtml#rgn_cnt_0004' id='mo1_par4_text'/>";
smil += "<audio clipBegin='9.775s' clipEnd='15.804s' id='mo1_par4_audio' src='hauy_0001.mp3'/>";
smil += "</par>";

// made-up pars to test clock values
smil += "<par id='testpar1'>";
smil += "<text src='test.xhtml#frag' id='testtext1'/>";
smil += "<audio clipBegin='5:34:31.396' clipEnd='124:59:36' src='test.mp3' id='testaud1'/>";
smil += "</par>";

smil += "<par id='testpar2'>";
smil += "<text src='test.xhtml#frag' id='testtext2'/>";
smil += "<audio clipBegin='0:00:04' clipEnd='0:05:01.2' src='test.mp3' id='testaud2'/>";
smil += "</par>";

smil += "<par id='testpar3'>";
smil += "<text src='test.xhtml#frag' id='testtext3'/>";
smil += "<audio clipBegin='00:56.78' clipEnd='09:58' src='test.mp3' id='testaud3'/>";
smil += "</par>";

smil += "<par id='testpar4'>";
smil += "<text src='test.xhtml#frag' id='testtext4'/>";
smil += "<audio clipBegin='13min' clipEnd='7.75h' src='test.mp3' id='testaud4'/>";
smil += "</par>";

// seq test data
smil += "<seq id='testseq1' epub:textref='test.xhtml#frag0' epub:type='sidebar'>";
smil += "<par id='testpar5' epub:type='pagebreak'>";
smil += "<text src='test.xhtml#frag' id='testtext5'/>";
smil += "<audio clipBegin='2345ms' clipEnd='76.2s' src='test.mp3' id='testaud5'/>";
smil += "</par>";

smil += "<par id='testpar6'>";
smil += "<text src='test.xhtml#frag' id='testtext6'/>";
smil += "<audio clipBegin='0' clipEnd='12.345' src='test.mp3' id='testaud6'/>";
smil += "</par>";
smil += "</seq>";

smil += "<par id='testpar7'>";
smil += "<text src='test.xhtml#frag' id='testtext7'/>";
smil += "<audio src='test.mp3' id='testaud7'/>";
smil += "</par>";

smil += "</body>";
smil += "</smil>";


describe("SmilModel tests: ", function() {
    var smilModel;
    beforeEach(function() {
        
        this.addMatchers({
            toBeAnInstanceOf: function(expected) {
                var actual = this.actual;
                this.message = function () {
                    return "Expected " + actual + " to be an instance of " + expected;
                }
                return actual instanceof expected;
            }
        });
        
        var parser = new window.DOMParser;
        var dom = parser.parseFromString(smil, 'text/xml');
        smilModel = new SmilModel();
        smilModel.setUrl("http://example.org/file.smil");
        smilModel.addRenderers({"audio": audioRender, "text": textRender});
        smilModel.build($(dom).find("body")[0]);
        function audioRender() {
            console.log("Audio media: " + SmilModel.smilNodeToString(this));
        }
        function textRender() {
            console.log("Text media: " + SmilModel.smilNodeToString(this));
        }
    });
    
    describe('creates smil model, ', function() {
        it('model is not null', function() {
          expect(smilModel).not.toBeNull();  
        });
    });
    
    describe('can find nodes, ', function() {
       it('finds a node by its id', function() {
          var node = smilModel.findNode("", "id", "mo1_par1");
          expect(node.getAttribute("id")).toEqual("mo1_par1");
       });
       
       it('finds the first node of the given type', function() {
          var node = smilModel.findNode("par");
          expect(node.getAttribute("id")).toEqual("mo1_par1");
       });
       
       it('finds the first node of the given type with the given attribute', function() {
          var node = smilModel.findNode("text", "src", "test.xhtml#frag");
          expect(node.getAttribute("id")).toEqual("testtext1"); 
       });
    });
    
    describe('clock value parsing', function() {
      it('parses h:mm:ss.fraction', function() {
          var node = smilModel.findNode("", "id", "testaud1");
          expect(node.getAttribute("clipBegin")).toEqual('20071.396'); //5:34:31.396
      });
      it('parses hhh:mm:ss', function() {
          var node = smilModel.findNode("", "id", "testaud1");
          expect(node.getAttribute("clipEnd")).toEqual('449976'); //124:59:36
      });
      
      it('parses 0:00:ss', function() {
         var node = smilModel.findNode("", "id", "testaud2");
         expect(node.getAttribute("clipBegin")).toEqual('4'); //0:00:04
      });
      it('parses 0:mm:ss.fraction', function() {
         var node = smilModel.findNode("", "id", "testaud2");
         expect(node.getAttribute("clipEnd")).toEqual('301.2'); // 0:05:01.2
      });
      
      it('parses 00:ss.fraction', function() {
          var node = smilModel.findNode("", "id", "testaud3");
          expect(node.getAttribute("clipBegin")).toEqual('56.78'); //00:56.78
      });
      it('parses mm:ss', function() {
         var node = smilModel.findNode("", "id", "testaud3");
         expect(node.getAttribute("clipEnd")).toEqual('598'); //09:58
      });
      
      it('parses min', function() {
          var node = smilModel.findNode("", "id", "testaud4");
          expect(node.getAttribute("clipBegin")).toEqual('780'); //13min
      });
      it('parses h', function() {
         var node = smilModel.findNode("", "id", "testaud4");
         expect(node.getAttribute("clipEnd")).toEqual('27900') //7.75h
      });
      
      it('parses ms', function() {
          var node = smilModel.findNode("", "id", "testaud5");
          expect(node.getAttribute("clipBegin")).toEqual('2.345'); //2345ms
      });
      it('parses s', function() {
         var node = smilModel.findNode("", "id", "testaud5");
         expect(node.getAttribute("clipEnd")).toEqual('76.2'); //76.2s
      });
      
      it('parses plain syntax', function() {
          var node = smilModel.findNode("", "id", "testaud6");
          expect(node.getAttribute("clipEnd")).toEqual('12.345'); //12.345
      });
      it('fills in a missing clipBegin value', function() {
         var node = smilModel.findNode("", "id", "testaud7");
         expect(node.getAttribute("clipBegin")).toEqual('0');
      });
      it('fills in a missing clipEnd value', function() {
          var node = smilModel.findNode("", "id", "testaud7");
          expect(node.getAttribute("clipEnd")).toEqual('9999999');
      });
    });
    
    describe("skippability", function() {
       it("skips nodes of type = epub:pagebreak", function() {
           smilModel.addSkipType("pagebreak");
           var node = smilModel.findNode("", "id", "testpar5");
           expect(smilModel.testMustSkip(node)).toEqual(true);
       });
       it("skips children whose parent has type = epub:pagebreak", function() {
           smilModel.addSkipType("pagebreak");
           var node = smilModel.findNode("", "id", "testtext5");
           expect(smilModel.testMustSkip(node)).toEqual(true);
       });
       it("removes skip types", function() {
           smilModel.addSkipType("pagebreak");
           var node = smilModel.findNode("", "id", "testpar5");
           smilModel.removeSkipType("pagebreak");
           expect(smilModel.testMustSkip(node)).toEqual(false);
       });
    });
    
    describe("escapability", function() {
        it("can escape nodes of type = epub:sidebar", function() {
            smilModel.addEscapeType("sidebar"); 
            var node = smilModel.findNode("", "id", "testseq1");
            expect(smilModel.testCanEscape(node)).toEqual(true);
        });
        it("can escape children whose parent has type = epub:sidebar", function() {
            smilModel.addEscapeType("sidebar");
            var node = smilModel.findNode("", "id", "testaud5");
            expect(smilModel.testCanEscape(node)).toEqual(true);
        });
        it("removes escape types", function() {
            smilModel.addEscapeType("sidebar");
            var node = smilModel.findNode("", "id", "testseq1");
            smilModel.removeSkipType("sidebar");
            expect(smilModel.testMustSkip(node)).toEqual(false);
        });
        
    });
});
