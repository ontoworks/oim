/*
 *
 * Copyright (c) 2010 C. F., Wong (<a href="http://cloudgen.w0ng.hk">Cloudgen Examplet Store</a>)
 * Licensed under the MIT License:
 * http://www.opensource.org/licenses/mit-license.php
 *
 */
﻿(function($){
var className="Truncator",
re1=/(<(?:[^>"']|'[^']*'|"[^"]*")+>)|([\s\r\n]+)|(\S)/g,
re2=/<\s*([^\s>]*)\s*>([\s\S](?!<\/\1>))*[\s\S]<\/\1>|<hr\s*\/?>|<br\s*\/?>|<li\s*\/?>/ig,
re3=/\[\[/g,
re4=/\]\]/g;
	function truncate(obj,t,c){
		var truncText=[],
			remain=[],
			count=0,
			noMoreText=false;
		$(t).html().replace(
			re1
		,function(s,s1,s2,s3){
			if(typeof s3==="string" && s3!="") {
				if(!noMoreText){
					truncText.push(s3);
					count++
				}
			}else if(typeof s2==="string" && s2!=""){
				if(count>=c) 
					noMoreText=true;
				if(!noMoreText){
					truncText.push(" ");
					count++
				}
			}else if(typeof s1==="string" && s1!=""){
				if(count>=c) 
					noMoreText=true;
				if(count<c)
					truncText.push(s1);
				else
					remain.push(s1);
			} 
		});
		re=remain.join("").replace(
			re2
		,"");
		if(re=="") this.disabled=true;
		return truncText.join("")+re
	}
	function Truncator(
		target,n,trail_more,trail_less,originalText,seed
	){
		var n=n||60,
			trail_more=trail_more||"[[...]]",
			trail_less=trail_less||"",
			originalText=originalText||"",
			seed=seed||null;
		if(target) {
			this.init(target,n,trail_more,trail_less,originalText);
			if(
				!$(target).data("init") || 
				typeof $(target).data("init").length=="undefined"
			) 
				$(target).data("init",[]);
			if(originalText=="")
				originalText=this.originalText;
			if(!seed)
				seed=this.seed;
			$(target)
			.data("init")
			.push(function(e){
				new Truncator(e,n,trail_more,trail_less,originalText,seed)
				.live()
			});
		}
	}
	Truncator.prototype.init=function(
		target,n,trail_more,trail_less,originalText,seed
	){
		this.className=className;
		this.seed=seed|Math.round(Math.random()*10000);
		this.disabled=false;
		this.target=$(target)
			.data(className,this)
			.addClass(className+this.seed);
		this.showClass=className+"show"+this.seed;
		this.hideClass=className+"hide"+this.seed;
		if(originalText && originalText!="") 
			this.originalText=originalText;
		else this.originalText=this.target.html();
		this.truncText=truncate(this,target,n);
		this.trail_more=trail_more.replace(
			re3,
			'<a href="javascript:void(0)" class="'+this.showClass+'">'
		).replace(
			re4,
			'</a>'
		);
		this.trail_less=trail_less.replace(
			re3,
			'<a href="javascript:void(0)" class="'+this.hideClass+'">'
		).replace(
			re4,
			'</a>'
		);
		if(this.disabled) this.show();
		else this.hide()
	};
	Truncator.prototype.show=function(){
		var r=this.originalText;
		if(!this.disabled)
			r+=this.trail_less;
		this
		.target
		.html(r);
		return this
	};
	Truncator.prototype.html=function(t){
		if(t){
			this
			.target
			.html(t);
			return this
		} else 
			return this
				.target
				.html()
	}
	Truncator.prototype.hide=function(){
		if(this.truncText.length==this.originalText.length)
			this.target.html(this.truncText);
		else
			this.target.html(this.truncText+this.trail_more);
		return this
	};
	Truncator.prototype.live=function(){
		var t=this;
		if (!this.goLive){
			$("."+this.showClass)
			.live("click",function(){
				t.show();
			});
			$("."+this.hideClass)
			.live("click",function(){
				t.hide();
			});
			this.goLive=true;
		}
		return this
	};
	$.fn.trunc=function(
		n,trail_more,trail_less
	){
		this.each(function(){
			new Truncator(this,n,trail_more,trail_less)
			.live()
		});
		return this
	};
})(jQuery);
